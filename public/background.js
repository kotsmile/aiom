// ---------- Native-site profiles ----------

const SITE_PROFILES = {
  chatgpt: {
    urlMatch: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
    newChatUrl: 'https://chatgpt.com/',
    inputSelectors: ['#prompt-textarea', 'form [contenteditable="true"]'],
    sendSelectors: ['button[data-testid="send-button"]', 'form button[type="submit"]:not([disabled])'],
    inputKind: 'prosemirror',
  },
  claude: {
    urlMatch: ['https://claude.ai/*'],
    newChatUrl: 'https://claude.ai/new',
    inputSelectors: ['div[contenteditable="true"].ProseMirror', 'div[aria-label*="prompt" i][contenteditable="true"]'],
    sendSelectors: ['button[aria-label="Send message"]', 'button[aria-label*="send" i]'],
    inputKind: 'prosemirror',
  },
  gemini: {
    urlMatch: ['https://gemini.google.com/*'],
    newChatUrl: 'https://gemini.google.com/app',
    inputSelectors: ['div.ql-editor[contenteditable="true"]', 'rich-textarea div[contenteditable="true"]'],
    sendSelectors: ['button[aria-label*="Send" i]', 'button.send-button'],
    inputKind: 'quill',
  },
  perplexity: {
    urlMatch: ['https://www.perplexity.ai/*'],
    newChatUrl: 'https://www.perplexity.ai/',
    inputSelectors: ['textarea[placeholder*="Ask" i]', 'textarea#ask-input', 'main textarea'],
    sendSelectors: ['button[aria-label*="Submit" i]', 'button[type="submit"]'],
    inputKind: 'textarea',
  },
}

// ---------- Page-world injected fn ----------
// IMPORTANT: stays self-contained — runs with no closure access. All inputs via args.
async function fillAndSend(prompt, profile) {
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

  // Auth-wall heuristic
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
    // ProseMirror / Quill — paste a DataTransfer payload
    inputEl.focus()
    const dt = new DataTransfer()
    dt.setData('text/plain', prompt)
    inputEl.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }

  // Try the send button first, with a short retry while it un-disables
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
    // Fallback: dispatch Enter on the input element. Only safe because we already filled it.
    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }
    inputEl.dispatchEvent(new KeyboardEvent('keydown', opts))
    inputEl.dispatchEvent(new KeyboardEvent('keypress', opts))
    inputEl.dispatchEvent(new KeyboardEvent('keyup', opts))
  }

  return { ok: true, matchedInput: inputHit.selector, viaSendButton: sent }
}

// ---------- Tab management + injection ----------

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('tab-load-timeout'))
    }, timeoutMs)
    const listener = (id, changeInfo) => {
      if (id !== tabId || changeInfo.status !== 'complete') return
      if (done) return
      done = true
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }
    chrome.tabs.onUpdated.addListener(listener)
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return
      if (tab && tab.status === 'complete' && !done) {
        done = true
        clearTimeout(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    })
  })
}

async function injectPromptIntoNativeSite(siteId, prompt) {
  const profile = SITE_PROFILES[siteId]
  if (!profile) return { ok: false, reason: 'unknown-site' }

  let tab
  try {
    const existing = await chrome.tabs.query({ url: profile.urlMatch })
    if (existing && existing.length > 0) {
      const focused = existing.find((t) => t.active) || existing[0]
      tab = focused
      await chrome.tabs.update(tab.id, { active: true })
      if (typeof tab.windowId === 'number') {
        await chrome.windows.update(tab.windowId, { focused: true })
      }
    } else {
      tab = await chrome.tabs.create({ url: profile.newChatUrl, active: true })
    }
  } catch (err) {
    return { ok: false, reason: 'tab-error', detail: String(err) }
  }

  try {
    await waitForTabComplete(tab.id)
  } catch (err) {
    return { ok: false, reason: 'tab-load-timeout', detail: String(err) }
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      args: [prompt, profile],
      func: fillAndSend,
    })
    return result?.result ?? { ok: false, reason: 'no-result' }
  } catch (err) {
    return { ok: false, reason: 'inject-error', detail: String(err) }
  }
}

// ---------- Wiring ----------

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-aiom',
    title: 'Send to aiom',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'explain-aiom',
    title: 'Ask aiom to explain',
    contexts: ['selection'],
  })
})

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error))

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText) return

  let pendingMessage
  if (info.menuItemId === 'send-to-aiom') {
    pendingMessage = {
      text: info.selectionText,
      title: info.selectionText.slice(0, 40),
    }
  } else if (info.menuItemId === 'explain-aiom') {
    pendingMessage = {
      text: info.selectionText,
      title: info.selectionText.slice(0, 40),
      systemPrompt: 'Explain the following term or concept in simple words:',
    }
  } else {
    return
  }

  // Open the side panel synchronously to preserve the user gesture, then write
  // the pending message. Both API and native modes route through the side panel —
  // the side panel itself decides where to send (native iframe, native tab fallback,
  // or API call) based on settings.mode.
  if (tab?.windowId !== undefined) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => console.error(error))
  }
  chrome.storage.local.set({ pendingMessage })
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'native-send') {
    injectPromptIntoNativeSite(msg.site, msg.prompt).then(sendResponse)
    return true // async response
  }
  return false
})
