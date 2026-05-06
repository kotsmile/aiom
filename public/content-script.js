// Runs in MAIN world, all frames, on the 4 native AI sites.
// Communicates with the side panel parent via window.postMessage only.
//
// Protocol:
//  - On load (and on URL change), if running in an iframe, post { type: 'aiom-ready', site, url }
//    to window.parent.
//  - Listen for { type: 'aiom-fill', prompt, requestId } from the parent. On receipt,
//    run fill+send and post back { type: 'aiom-result', requestId, ok, reason?, ... }.

(() => {
  // Don't run twice if injected somehow.
  if (window.__aiomContentScriptLoaded) return
  window.__aiomContentScriptLoaded = true

  const PROFILES = {
    'chatgpt.com': {
      site: 'chatgpt',
      inputSelectors: ['#prompt-textarea', 'form [contenteditable="true"]'],
      sendSelectors: ['button[data-testid="send-button"]', 'form button[type="submit"]:not([disabled])'],
      inputKind: 'prosemirror',
    },
    'chat.openai.com': {
      site: 'chatgpt',
      inputSelectors: ['#prompt-textarea', 'form [contenteditable="true"]'],
      sendSelectors: ['button[data-testid="send-button"]', 'form button[type="submit"]:not([disabled])'],
      inputKind: 'prosemirror',
    },
    'claude.ai': {
      site: 'claude',
      inputSelectors: ['div[contenteditable="true"].ProseMirror', 'div[aria-label*="prompt" i][contenteditable="true"]'],
      sendSelectors: ['button[aria-label="Send message"]', 'button[aria-label*="send" i]'],
      inputKind: 'prosemirror',
    },
    'gemini.google.com': {
      site: 'gemini',
      inputSelectors: ['div.ql-editor[contenteditable="true"]', 'rich-textarea div[contenteditable="true"]'],
      sendSelectors: ['button[aria-label*="Send" i]', 'button.send-button'],
      inputKind: 'quill',
    },
    'www.perplexity.ai': {
      site: 'perplexity',
      inputSelectors: ['textarea[placeholder*="Ask" i]', 'textarea#ask-input', 'main textarea'],
      sendSelectors: ['button[aria-label*="Submit" i]', 'button[type="submit"]'],
      inputKind: 'textarea',
    },
    'perplexity.ai': {
      site: 'perplexity',
      inputSelectors: ['textarea[placeholder*="Ask" i]', 'textarea#ask-input', 'main textarea'],
      sendSelectors: ['button[aria-label*="Submit" i]', 'button[type="submit"]'],
      inputKind: 'textarea',
    },
  }

  const profile = PROFILES[location.host]
  if (!profile) return

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  function waitFor(selectors, timeoutMs) {
    return new Promise((resolve, reject) => {
      const find = () => {
        for (const s of selectors) {
          const el = document.querySelector(s)
          if (el) return { el, selector: s }
        }
        return null
      }
      const hit = find()
      if (hit) return resolve(hit)
      const obs = new MutationObserver(() => {
        const h = find()
        if (h) {
          obs.disconnect()
          resolve(h)
        }
      })
      obs.observe(document.documentElement, { childList: true, subtree: true })
      setTimeout(() => {
        obs.disconnect()
        reject(new Error('timeout'))
      }, timeoutMs)
    })
  }

  async function fillAndSend(prompt) {
    if (/\/(login|sign-?in|signup)/i.test(location.pathname)) {
      return { ok: false, reason: 'auth' }
    }

    let inputHit
    try {
      inputHit = await waitFor(profile.inputSelectors, 15000)
    } catch {
      return { ok: false, reason: 'input-not-found' }
    }
    const inputEl = inputHit.el

    if (profile.inputKind === 'textarea') {
      const proto = Object.getPrototypeOf(inputEl)
      const desc = Object.getOwnPropertyDescriptor(proto, 'value')
      if (desc && desc.set) {
        desc.set.call(inputEl, prompt)
      } else {
        inputEl.value = prompt
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }))
      inputEl.focus()
    } else {
      inputEl.focus()
      const dt = new DataTransfer()
      dt.setData('text/plain', prompt)
      inputEl.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      )
    }

    let sent = false
    const deadline = Date.now() + 1500
    while (Date.now() < deadline) {
      let btn = null
      for (const s of profile.sendSelectors) {
        const candidate = document.querySelector(s)
        if (candidate && !candidate.disabled && candidate.getAttribute('aria-disabled') !== 'true') {
          btn = candidate
          break
        }
      }
      if (btn) {
        btn.click()
        sent = true
        break
      }
      await sleep(150)
    }

    if (!sent) {
      const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }
      inputEl.dispatchEvent(new KeyboardEvent('keydown', opts))
      inputEl.dispatchEvent(new KeyboardEvent('keypress', opts))
      inputEl.dispatchEvent(new KeyboardEvent('keyup', opts))
    }

    return { ok: true, matchedInput: inputHit.selector, viaSendButton: sent }
  }

  function announceReady() {
    if (window.parent === window) return // Top-level tab — no parent to talk to.
    try {
      window.parent.postMessage(
        { type: 'aiom-ready', site: profile.site, url: location.href },
        '*',
      )
    } catch {}
  }

  // Tell the parent we're alive on first paint, and again when the SPA changes URL.
  announceReady()
  let lastHref = location.href
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href
      announceReady()
    }
  }, 1000)

  window.addEventListener('message', async (event) => {
    const data = event.data
    if (!data || data.type !== 'aiom-fill' || event.source !== window.parent) return
    const { prompt, requestId } = data
    if (typeof prompt !== 'string') return
    try {
      const result = await fillAndSend(prompt)
      window.parent.postMessage({ type: 'aiom-result', requestId, ...result }, '*')
    } catch (err) {
      window.parent.postMessage(
        { type: 'aiom-result', requestId, ok: false, reason: 'exception', detail: String(err) },
        '*',
      )
    }
  })
})()
