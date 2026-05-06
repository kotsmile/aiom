import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import type { Chat, ChatMessage, Mode, NativeSiteId, Settings } from '../types'
import { Markdown } from '../components/Markdown'
import {
  getSettings,
  saveSettings,
  getChats,
  saveChats,
  getActiveChatId,
  saveActiveChatId,
  getPendingMessage,
  clearPendingMessage,
  newChatId,
  type PendingMessage,
} from '../lib/storage'
import { NATIVE_SITES, nativeSiteEmbedUrl, nativeSiteLabel } from '../lib/nativeSites'
import { sendMessage } from '../lib/providers'

const MAX_INPUT_HEIGHT = 140

export function Popup() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const streamingTextRef = useRef<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [replyContext, setReplyContext] = useState<string | null>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [inputHeight, setInputHeight] = useState<number>(40)
  const [nativeStatus, setNativeStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)
  const [iframeStatus, setIframeStatus] = useState<'connecting' | 'ready' | 'failed'>('connecting')
  const [iframeReloadKey, setIframeReloadKey] = useState(0)
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeReadyRef = useRef(false)
  const pendingResolversRef = useRef<Map<string, (r: { ok: boolean; reason?: string }) => void>>(new Map())
  const abortRef = useRef<AbortController | null>(null)
  const settingsRef = useRef<Settings | null>(null)
  const chatsRef = useRef<Chat[]>([])

  const activeChat = chats.find((c) => c.id === activeChatId) || null

  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { chatsRef.current = chats }, [chats])

  const explainStatus = (site: NativeSiteId, reason: string | undefined): string => {
    const label = nativeSiteLabel(site)
    switch (reason) {
      case 'auth': return `Sign in to ${label} and try again.`
      case 'input-not-found': return `Couldn't find the composer on ${label}.`
      case 'tab-load-timeout': return `${label} took too long to load.`
      case 'iframe-timeout': return `${label} didn't load in the side panel — try again or open in a new tab.`
      default: return `Failed to send to ${label}${reason ? ` (${reason})` : ''}.`
    }
  }

  const sendViaIframe = (prompt: string): Promise<{ ok: boolean; reason?: string }> => {
    return new Promise((resolve) => {
      const iframe = iframeRef.current
      if (!iframe || !iframe.contentWindow || !iframeReadyRef.current) {
        resolve({ ok: false, reason: 'iframe-not-ready' })
        return
      }
      const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const timer = setTimeout(() => {
        pendingResolversRef.current.delete(requestId)
        resolve({ ok: false, reason: 'iframe-timeout' })
      }, 20000)
      pendingResolversRef.current.set(requestId, (r) => {
        clearTimeout(timer)
        resolve(r)
      })
      iframe.contentWindow.postMessage({ type: 'aiom-fill', prompt, requestId }, '*')
    })
  }

  const sendViaTab = async (site: NativeSiteId, prompt: string): Promise<{ ok: boolean; reason?: string }> => {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'native-send', site, prompt })
      return result ?? { ok: false, reason: 'no-response' }
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'send-error' }
    }
  }

  const waitForIframeReady = (timeoutMs: number): Promise<boolean> => {
    if (iframeReadyRef.current) return Promise.resolve(true)
    return new Promise((resolve) => {
      const start = Date.now()
      const tick = () => {
        if (iframeReadyRef.current) return resolve(true)
        if (Date.now() - start >= timeoutMs) return resolve(false)
        setTimeout(tick, 100)
      }
      tick()
    })
  }

  const sendNative = async (site: NativeSiteId, prompt: string): Promise<{ ok: boolean; reason?: string }> => {
    setSending(true)
    setNativeStatus(null)
    try {
      let result: { ok: boolean; reason?: string }
      const sameSite = settingsRef.current?.nativeSite === site
      // Prefer the embedded iframe when it's ready (or about to be) and matches the active site.
      if (sameSite) {
        const ready = await waitForIframeReady(8000)
        if (ready) {
          result = await sendViaIframe(prompt)
          if (!result.ok && (result.reason === 'iframe-not-ready' || result.reason === 'iframe-timeout')) {
            result = await sendViaTab(site, prompt)
          }
        } else {
          result = await sendViaTab(site, prompt)
        }
      } else {
        result = await sendViaTab(site, prompt)
      }
      if (result.ok) {
        const status = { kind: 'ok' as const, message: `Sent to ${nativeSiteLabel(site)}` }
        setNativeStatus(status)
        setTimeout(() => {
          setNativeStatus((cur) => (cur === status ? null : cur))
        }, 1800)
      } else {
        const status = { kind: 'error' as const, message: explainStatus(site, result.reason) }
        setNativeStatus(status)
        setTimeout(() => {
          setNativeStatus((cur) => (cur === status ? null : cur))
        }, 6000)
      }
      return result
    } finally {
      setSending(false)
    }
  }

  const consumePending = async (pending: PendingMessage) => {
    const s = settingsRef.current
    if (!s) return
    await clearPendingMessage()
    try { chrome.action.setBadgeText({ text: '' }) } catch {}

    if (s.mode === 'native') {
      const text = pending.systemPrompt
        ? `${pending.systemPrompt}\n\n"${pending.text}"`
        : pending.text
      sendNative(s.nativeSite, text)
      return
    }

    const chat = { ...createChat(), title: pending.title }
    const loadedChats = [chat, ...chatsRef.current]
    setChats(loadedChats)
    setActiveChatId(chat.id)
    await saveChats(loadedChats)
    await saveActiveChatId(chat.id)
    doSend(pending.text, chat, loadedChats, s, pending.systemPrompt)
  }

  useEffect(() => {
    ;(async () => {
      const s = await getSettings()
      setSettings(s)
      settingsRef.current = s

      let loadedChats = await getChats()
      let activeId = await getActiveChatId()

      const pending = await getPendingMessage()
      if (pending) {
        await clearPendingMessage()
        try { chrome.action.setBadgeText({ text: '' }) } catch {}

        if (s.mode === 'native') {
          const text = pending.systemPrompt
            ? `${pending.systemPrompt}\n\n"${pending.text}"`
            : pending.text
          sendNative(s.nativeSite, text)
        } else {
          const chat = { ...createChat(), title: pending.title }
          loadedChats = [chat, ...loadedChats]
          activeId = chat.id
          setChats(loadedChats)
          setActiveChatId(activeId)
          await saveChats(loadedChats)
          await saveActiveChatId(activeId)
          doSend(pending.text, chat, loadedChats, s, pending.systemPrompt)
        }
      }

      if (loadedChats.length === 0) {
        const chat = createChat()
        loadedChats = [chat]
        await saveChats(loadedChats)
      }

      if (!activeId || !loadedChats.find((c) => c.id === activeId)) {
        activeId = loadedChats[0].id
      }

      setChats(loadedChats)
      setActiveChatId(activeId)
      await saveActiveChatId(activeId!)
    })()
  }, [])

  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'local') return
      const change = changes.pendingMessage
      if (!change?.newValue) return
      const raw = change.newValue
      const pending: PendingMessage = typeof raw === 'string'
        ? { text: raw, title: raw.slice(0, 40) }
        : raw
      consumePending(pending)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  // Listen for messages from the embedded iframe's content script.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (event.source !== iframeRef.current?.contentWindow) return
      if (data.type === 'aiom-ready') {
        iframeReadyRef.current = true
        setIframeStatus('ready')
      } else if (data.type === 'aiom-result' && typeof data.requestId === 'string') {
        const resolver = pendingResolversRef.current.get(data.requestId)
        if (resolver) {
          pendingResolversRef.current.delete(data.requestId)
          resolver({ ok: !!data.ok, reason: data.reason })
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Reset iframe handshake state whenever site or mode changes (or we manually reload).
  useEffect(() => {
    if (settings?.mode !== 'native') {
      iframeReadyRef.current = false
      setIframeStatus('connecting')
      return
    }
    iframeReadyRef.current = false
    setIframeStatus('connecting')
    const timer = setTimeout(() => {
      if (!iframeReadyRef.current) setIframeStatus('failed')
    }, 6000)
    return () => clearTimeout(timer)
  }, [settings?.mode, settings?.nativeSite, iframeReloadKey])

  const scrollToBottom = (smooth = true) => {
    const el = chatRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  // Scroll to bottom only when switching chats or message count changes (not on streamed chunks)
  const messageCount = activeChat?.messages.length ?? 0
  useEffect(() => {
    scrollToBottom(false)
  }, [activeChatId, messageCount])

  // Track scroll position to toggle "scroll to bottom" button
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      setShowScrollDown(distanceFromBottom > 80)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [activeChatId])

  // Re-evaluate scroll-down button visibility as content grows during streaming
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollDown(distanceFromBottom > 80)
  }, [streamingText, sending])

  // Auto-grow textarea — React-owned height to avoid reconciliation races
  useLayoutEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const next = Math.min(Math.max(ta.scrollHeight, 24), MAX_INPUT_HEIGHT)
    setInputHeight(next)
  }, [input, replyContext])

  function createChat(): Chat {
    return { id: newChatId(), title: 'New chat', messages: [], createdAt: Date.now() }
  }

  function updateChat(chatId: string, updater: (c: Chat) => Chat, allChats: Chat[]): Chat[] {
    return allChats.map((c) => (c.id === chatId ? updater(c) : c))
  }

  const doSend = async (text: string, chat: Chat, allChats: Chat[], s: Settings, systemPrompt?: string) => {
    if (!text.trim() || !s) return

    setSending(true)
    const ac = new AbortController()
    abortRef.current = ac

    const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: Date.now() }
    const newMessages = [...chat.messages, userMsg]

    const apiMessages: ChatMessage[] = systemPrompt
      ? [...chat.messages, { role: 'user' as const, content: `${systemPrompt}\n\n"${text.trim()}"`, timestamp: Date.now() }]
      : newMessages

    const title = chat.messages.length === 0 && chat.title === 'New chat'
      ? text.trim().slice(0, 40)
      : chat.title
    let updated = updateChat(chat.id, (c) => ({ ...c, messages: newMessages, title }), allChats)
    setChats(updated)
    setInput('')
    setReplyContext(null)
    await saveChats(updated)

    setStreamingText('')
    streamingTextRef.current = ''

    try {
      const reply = await sendMessage(
        apiMessages,
        s,
        {
          signal: ac.signal,
          onChunk: (text) => {
            setStreamingText(text)
            streamingTextRef.current = text
          },
        },
      )
      setStreamingText(null)
      const assistantMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: Date.now() }
      updated = updateChat(chat.id, (c) => ({ ...c, messages: [...newMessages, assistantMsg] }), updated)
      setChats(updated)
      await saveChats(updated)
    } catch (err: unknown) {
      const stoppedText = streamingTextRef.current
      setStreamingText(null)
      streamingTextRef.current = null
      if (err instanceof Error && err.name === 'AbortError' && stoppedText) {
        const partialMsg: ChatMessage = { role: 'assistant', content: stoppedText, timestamp: Date.now() }
        updated = updateChat(chat.id, (c) => ({ ...c, messages: [...newMessages, partialMsg] }), updated)
      } else {
        const errMsg: ChatMessage = {
          role: 'error',
          content: err instanceof Error && err.name === 'AbortError' ? 'Stopped.' : (err instanceof Error ? err.message : 'Unknown error'),
          timestamp: Date.now(),
        }
        updated = updateChat(chat.id, (c) => ({ ...c, messages: [...newMessages, errMsg] }), updated)
      }
      setChats(updated)
      await saveChats(updated)
    }

    abortRef.current = null
    setSending(false)
    inputRef.current?.focus()
  }

  const handleSend = () => {
    if (!settings) return
    const text = replyContext
      ? `> ${replyContext.split('\n').join('\n> ')}\n\n${input}`
      : input
    if (!text.trim()) return

    if (settings.mode === 'native') {
      sendNative(settings.nativeSite, text).then((res) => {
        if (res.ok) {
          setInput('')
          setReplyContext(null)
        }
      })
      return
    }

    if (!activeChat) return
    doSend(text, activeChat, chats, settings)
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleNewChat = async () => {
    const chat = createChat()
    const updated = [chat, ...chats]
    setChats(updated)
    setActiveChatId(chat.id)
    setSidebarOpen(false)
    setReplyContext(null)
    await saveChats(updated)
    await saveActiveChatId(chat.id)
    inputRef.current?.focus()
  }

  const handleSelectChat = async (id: string) => {
    setActiveChatId(id)
    setSidebarOpen(false)
    setReplyContext(null)
    await saveActiveChatId(id)
  }

  const handleDeleteChat = async (id: string) => {
    let updated = chats.filter((c) => c.id !== id)
    if (updated.length === 0) {
      updated = [createChat()]
    }
    const newActiveId = id === activeChatId ? updated[0].id : activeChatId!
    setChats(updated)
    setActiveChatId(newActiveId)
    await saveChats(updated)
    await saveActiveChatId(newActiveId)
  }

  const openSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') })
  }

  const handleCopy = async (key: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500)
    } catch {}
  }

  const handleReply = (content: string) => {
    setReplyContext(content)
    inputRef.current?.focus()
  }

  // Re-run a message: trim from this index onward, then resend the last user message
  const handleAgain = async (index: number) => {
    if (!settings || !activeChat || sending) return
    const msg = activeChat.messages[index]

    let trimUpto: number
    let resendText: string
    if (msg.role === 'user') {
      trimUpto = index
      resendText = msg.content
    } else {
      // Find the most recent user message before this one
      let userIdx = -1
      for (let i = index - 1; i >= 0; i--) {
        if (activeChat.messages[i].role === 'user') { userIdx = i; break }
      }
      if (userIdx < 0) return
      trimUpto = userIdx
      resendText = activeChat.messages[userIdx].content
    }

    const trimmedMessages = activeChat.messages.slice(0, trimUpto)
    const trimmedChat: Chat = { ...activeChat, messages: trimmedMessages }
    const updatedChats = updateChat(activeChat.id, () => trimmedChat, chats)
    setChats(updatedChats)
    await saveChats(updatedChats)

    doSend(resendText, trimmedChat, updatedChats, settings)
  }

  const updateActiveProvider = async (providerId: string) => {
    if (!settings) return
    const newProvider = settings.providers[providerId]
    const next: Settings = {
      ...settings,
      activeProvider: providerId,
      activeModel: newProvider?.models[0] || '',
    }
    setSettings(next)
    settingsRef.current = next
    await saveSettings(next)
  }

  const updateActiveModel = async (model: string) => {
    if (!settings) return
    const next: Settings = { ...settings, activeModel: model }
    setSettings(next)
    settingsRef.current = next
    await saveSettings(next)
  }

  const updateMode = async (mode: Mode) => {
    if (!settings) return
    const next: Settings = { ...settings, mode }
    setSettings(next)
    settingsRef.current = next
    setNativeStatus(null)
    await saveSettings(next)
  }

  const updateNativeSite = async (nativeSite: NativeSiteId) => {
    if (!settings) return
    const next: Settings = { ...settings, nativeSite }
    setSettings(next)
    settingsRef.current = next
    setNativeStatus(null)
    await saveSettings(next)
  }

  const isNative = settings?.mode === 'native'
  const provider = settings?.providers[settings.activeProvider]
  const models = provider?.models || []
  const noAuth = !isNative && (!provider || (!provider.apiKey && !Object.keys(provider.headers || {}).length))

  return (
    <div className="w-full h-screen flex text-[15px] text-zinc-800 bg-white dark:text-zinc-100 dark:bg-zinc-900 font-sans relative overflow-hidden">
      {/* Sidebar */}
      <div
        className={`absolute inset-y-0 left-0 z-10 w-60 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 flex flex-col transition-transform duration-200 border-r border-zinc-200 dark:border-zinc-800 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <button
            onClick={handleNewChat}
            className="flex-1 flex items-center gap-2 bg-transparent hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors"
          >
            <span className="text-base leading-none">＋</span>
            <span>New chat</span>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-2 bg-transparent border-none text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer text-base p-1 leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center gap-1 px-2.5 py-2 rounded-lg cursor-pointer text-[13px] mb-0.5 transition-colors ${
                chat.id === activeChatId
                  ? 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                  : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
              }`}
              onClick={() => handleSelectChat(chat.id)}
            >
              <span className="flex-1 truncate">{chat.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteChat(chat.id)
                }}
                className="opacity-0 group-hover:opacity-100 bg-transparent border-none text-zinc-500 hover:text-red-500 cursor-pointer text-sm p-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 gap-2 border-b border-zinc-200 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] z-10">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="bg-transparent border-none text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1.5 rounded-md text-[15px] cursor-pointer leading-none"
              title="Toggle chats"
            >
              ☰
            </button>
            {/* Mode-aware selectors */}
            {settings && (
              <div className="flex items-center gap-1 min-w-0">
                <select
                  value={settings.mode}
                  onChange={(e) => updateMode(e.target.value as Mode)}
                  className="appearance-none bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 border-none rounded-md px-2 py-1 text-[12px] font-medium cursor-pointer focus:outline-none truncate"
                  title="Mode"
                >
                  <option value="api">API</option>
                  <option value="native">Native</option>
                </select>
                {settings.mode === 'api' ? (
                  <>
                    <select
                      value={settings.activeProvider}
                      onChange={(e) => updateActiveProvider(e.target.value)}
                      className="appearance-none bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 border-none rounded-md px-2 py-1 text-[12px] font-medium cursor-pointer focus:outline-none max-w-[110px] truncate"
                      title="Provider"
                    >
                      {Object.entries(settings.providers).map(([id, p]) => (
                        <option key={id} value={id}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={settings.activeModel}
                      onChange={(e) => updateActiveModel(e.target.value)}
                      className="appearance-none bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 border-none rounded-md px-2 py-1 text-[12px] font-medium cursor-pointer focus:outline-none max-w-[140px] truncate"
                      title="Model"
                    >
                      {models.length === 0 && <option value="">No models</option>}
                      {models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <select
                    value={settings.nativeSite}
                    onChange={(e) => updateNativeSite(e.target.value as NativeSiteId)}
                    className="appearance-none bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 border-none rounded-md px-2 py-1 text-[12px] font-medium cursor-pointer focus:outline-none max-w-[140px] truncate"
                    title="Native site"
                  >
                    {NATIVE_SITES.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-0.5 shrink-0">
            {!isNative && (
              <button
                onClick={handleNewChat}
                className="bg-transparent border-none text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1.5 rounded-md text-[15px] cursor-pointer leading-none"
                title="New chat"
              >
                ＋
              </button>
            )}
            <button
              onClick={openSettings}
              className="bg-transparent border-none text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1.5 rounded-md text-[15px] cursor-pointer leading-none"
              title="Settings"
            >
              ⚙
            </button>
          </div>
        </header>

        {/* Banner */}
        {noAuth && (
          <div className="mx-3 mt-1 mb-2 px-3 py-2 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-[13px] rounded-lg border border-amber-200/60 dark:border-amber-900/50">
            No API key configured.{' '}
            <a onClick={openSettings} className="font-medium underline cursor-pointer">
              Open Settings
            </a>
          </div>
        )}

        {/* Native: embedded iframe replaces the chat area entirely */}
        {isNative && settings && (
          <div className="flex-1 min-w-0 relative bg-white dark:bg-zinc-900">
            <iframe
              ref={iframeRef}
              key={`${settings.nativeSite}-${iframeReloadKey}`}
              src={nativeSiteEmbedUrl(settings.nativeSite)}
              title={nativeSiteLabel(settings.nativeSite)}
              className="absolute inset-0 w-full h-full border-0"
              allow="clipboard-read; clipboard-write; microphone; camera"
            />
            {iframeStatus !== 'ready' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-zinc-900/90 text-center px-6 gap-3">
                {iframeStatus === 'connecting' ? (
                  <>
                    <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '300ms' }} />
                    </div>
                    <div className="text-[13px] text-zinc-500 dark:text-zinc-400">
                      Loading {nativeSiteLabel(settings.nativeSite)}…
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[14px] font-medium text-zinc-800 dark:text-zinc-100">
                      Couldn't embed {nativeSiteLabel(settings.nativeSite)}
                    </div>
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-400 max-w-[32ch] leading-relaxed">
                      The site refused to load in the side panel (likely sign-in or anti-framing). You can reload, or send prompts to a regular tab instead.
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIframeReloadKey((k) => k + 1)}
                        className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 border-none px-3 py-1.5 rounded-full text-[12px] font-medium cursor-pointer"
                      >
                        Reload
                      </button>
                      <button
                        onClick={() => {
                          if (settings) chrome.tabs.create({ url: nativeSiteEmbedUrl(settings.nativeSite) })
                        }}
                        className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-none px-3 py-1.5 rounded-full text-[12px] font-medium cursor-pointer hover:opacity-80"
                      >
                        Open in new tab
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {nativeStatus && (
              <div
                className={`absolute left-3 right-3 bottom-3 px-3 py-2 rounded-lg text-[12px] shadow-md ${
                  nativeStatus.kind === 'ok'
                    ? 'bg-zinc-900/90 text-white dark:bg-zinc-100/90 dark:text-zinc-900'
                    : 'bg-red-600/90 text-white'
                }`}
              >
                {nativeStatus.message}
              </div>
            )}
          </div>
        )}

        {/* Chat messages (API mode only) */}
        {!isNative && (
        <main ref={chatRef} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4 py-4 flex flex-col gap-5">
          {!isNative && activeChat?.messages.length === 0 && !sending && (
            <div className="flex-1 flex items-center justify-center text-center text-zinc-400 dark:text-zinc-500 text-[15px] py-12">
              How can I help today?
            </div>
          )}
          {!isNative && activeChat?.messages.map((msg, i) => {
            const key = `${activeChatId}-${i}`
            const isUser = msg.role === 'user'
            const isAssistant = msg.role === 'assistant'
            const isError = msg.role === 'error'
            const showActions = !isError
            return (
              <div key={i} className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'} min-w-0`}>
                <div
                  className={
                    isUser
                      ? 'max-w-[85%] min-w-0 px-3.5 py-2 rounded-2xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]'
                      : isError
                        ? 'max-w-full min-w-0 px-3.5 py-2 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] text-[13px]'
                        : 'max-w-full min-w-0 text-zinc-800 dark:text-zinc-100 leading-relaxed [overflow-wrap:anywhere]'
                  }
                >
                  {isAssistant ? <Markdown>{msg.content}</Markdown> : msg.content}
                </div>
                {showActions && (
                  <div className={`flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${isUser ? 'self-end' : 'self-start'}`}>
                    <ActionButton
                      title={copiedKey === key ? 'Copied' : 'Copy'}
                      onClick={() => handleCopy(key, msg.content)}
                    >
                      {copiedKey === key ? <CheckIcon /> : <CopyIcon />}
                    </ActionButton>
                    <ActionButton
                      title="Reply (use as context)"
                      onClick={() => handleReply(msg.content)}
                    >
                      <ReplyIcon />
                    </ActionButton>
                    <ActionButton
                      title="Regenerate"
                      onClick={() => handleAgain(i)}
                      disabled={sending}
                    >
                      <RefreshIcon />
                    </ActionButton>
                  </div>
                )}
              </div>
            )
          })}
          {sending && streamingText !== null && streamingText.length > 0 && (
            <div className="self-start max-w-full min-w-0 text-zinc-800 dark:text-zinc-100 leading-relaxed [overflow-wrap:anywhere]">
              <Markdown>{streamingText}</Markdown>
              <span className="inline-block w-1.5 h-4 bg-zinc-400 dark:bg-zinc-500 ml-0.5 align-middle animate-pulse" />
            </div>
          )}
          {sending && (streamingText === null || streamingText.length === 0) && (
            <div className="self-start flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </main>
        )}

        {/* Scroll-to-bottom floating button — anchored to viewport, not the scroll content */}
        {!isNative && showScrollDown && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute right-4 bottom-[88px] z-20 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-md hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer flex items-center justify-center"
            title="Scroll to bottom"
          >
            <ArrowDownIcon />
          </button>
        )}

        {/* Input (API mode only — native uses the iframe's own composer) */}
        {!isNative && (
        <footer className="px-3 pb-3 pt-1 bg-white dark:bg-zinc-900">
          {replyContext && (
            <div className="mb-1.5 flex items-start gap-2 bg-zinc-50 dark:bg-zinc-800/60 border-l-2 border-zinc-400 dark:border-zinc-500 rounded-r-lg px-2.5 py-1.5">
              <div className="flex-1 min-w-0 text-[12px] text-zinc-600 dark:text-zinc-300 leading-snug whitespace-pre-wrap line-clamp-3 [overflow-wrap:anywhere]">
                <span className="font-medium text-zinc-500 dark:text-zinc-400 mr-1">Replying to:</span>
                {replyContext}
              </div>
              <button
                onClick={() => setReplyContext(null)}
                className="shrink-0 bg-transparent border-none text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer text-sm leading-none p-0.5"
                title="Cancel reply"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-3xl pl-4 pr-2 py-2 border border-transparent focus-within:border-zinc-300 dark:focus-within:border-zinc-600 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={1}
              placeholder="Message aiom…"
              style={{ height: `${inputHeight}px`, maxHeight: `${MAX_INPUT_HEIGHT}px` }}
              className="flex-1 min-w-0 resize-none bg-transparent border-none py-2 text-[14px] leading-snug overflow-y-auto focus:outline-none placeholder-zinc-500 dark:placeholder-zinc-400 text-zinc-900 dark:text-zinc-100"
            />
            {sending ? (
              <button
                onClick={handleStop}
                className="shrink-0 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-none w-10 h-10 rounded-full cursor-pointer flex items-center justify-center hover:opacity-80"
                title="Stop"
              >
                <span className="block w-3 h-3 bg-current rounded-[3px]" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="shrink-0 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-none w-10 h-10 rounded-full text-lg cursor-pointer flex items-center justify-center hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                title="Send"
              >
                ↑
              </button>
            )}
          </div>
        </footer>
        )}
      </div>

      {/* Overlay to close sidebar */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-5 bg-black/20 dark:bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

interface ActionButtonProps {
  title: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}

function ActionButton({ title, onClick, disabled, children }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="bg-transparent border-none text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer rounded-md p-1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function ArrowDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  )
}
