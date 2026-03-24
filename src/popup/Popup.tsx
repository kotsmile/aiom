import { useState, useEffect, useRef } from 'react'
import type { ChatMessage, Settings } from '../types'
import {
  getSettings,
  getChatHistory,
  saveChatHistory,
  clearChatHistory,
  getPendingMessage,
  clearPendingMessage,
} from '../lib/storage'
import { sendMessage } from '../lib/providers'

export function Popup() {
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    ;(async () => {
      const s = await getSettings()
      const h = await getChatHistory()
      setSettings(s)
      setHistory(h)

      const pending = await getPendingMessage()
      if (pending) {
        await clearPendingMessage()
        chrome.action.setBadgeText({ text: '' })
        doSend(pending, h, s)
      }
    })()
  }, [])

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight)
  }, [history, sending])

  const doSend = async (text: string, hist: ChatMessage[], s: Settings) => {
    if (!text.trim() || !s) return

    setSending(true)
    const ac = new AbortController()
    abortRef.current = ac

    const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: Date.now() }
    const newHist = [...hist, userMsg]
    setHistory(newHist)
    setInput('')
    await saveChatHistory(newHist)

    try {
      const reply = await sendMessage(newHist, s, { signal: ac.signal })
      const assistantMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: Date.now() }
      const updated = [...newHist, assistantMsg]
      setHistory(updated)
      await saveChatHistory(updated)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setHistory([...newHist, { role: 'error', content: 'Stopped.', timestamp: Date.now() }])
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setHistory([...newHist, { role: 'error', content: msg, timestamp: Date.now() }])
      }
    }

    abortRef.current = null
    setSending(false)
    inputRef.current?.focus()
  }

  const handleSend = () => {
    if (settings) doSend(input, history, settings)
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleClear = async () => {
    setHistory([])
    await clearChatHistory()
  }

  const openSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') })
  }

  const provider = settings?.providers[settings.activeProvider]
  const modelLabel = provider
    ? `${provider.name} / ${settings!.activeModel}`
    : 'No provider'
  const noAuth = !provider || (!provider.apiKey && !Object.keys(provider.headers || {}).length)

  return (
    <div className="w-[400px] h-[500px] flex flex-col text-sm text-gray-900 bg-gray-50 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-3.5 py-2.5 bg-indigo-500 text-white">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-bold text-base shrink-0">aiom</span>
          <span className="text-[11px] opacity-80 truncate">{modelLabel}</span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleClear}
            className="bg-white/20 border-none text-white px-2.5 py-1 rounded text-[13px] cursor-pointer hover:bg-white/35"
          >
            Clear
          </button>
          <button
            onClick={openSettings}
            className="bg-white/20 border-none text-white px-2.5 py-1 rounded text-[13px] cursor-pointer hover:bg-white/35"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Banner */}
      {noAuth && (
        <div className="px-3.5 py-2 bg-amber-100 text-amber-800 text-[13px]">
          No API key configured.{' '}
          <a onClick={openSettings} className="text-indigo-500 underline cursor-pointer">
            Open Settings
          </a>
        </div>
      )}

      {/* Chat messages */}
      <main ref={chatRef} className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-2">
        {history.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] px-3 py-2 rounded-xl leading-relaxed whitespace-pre-wrap break-words ${
              msg.role === 'user'
                ? 'self-end bg-indigo-500 text-white rounded-br-sm'
                : msg.role === 'error'
                  ? 'self-start bg-red-100 text-red-800 rounded-bl-sm'
                  : 'self-start bg-gray-200 text-gray-900 rounded-bl-sm'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {sending && (
          <div className="self-start bg-gray-200 text-gray-500 italic px-3 py-2 rounded-xl rounded-bl-sm">
            Thinking...
          </div>
        )}
      </main>

      {/* Input */}
      <footer className="flex gap-2 px-3.5 py-2.5 border-t border-gray-200 bg-white">
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
          placeholder="Type a message..."
          className="flex-1 resize-none border border-gray-300 rounded-lg px-2.5 py-2 text-sm leading-snug max-h-20 overflow-y-auto focus:outline-none focus:border-indigo-500"
        />
        {sending ? (
          <button
            onClick={handleStop}
            className="bg-red-500 text-white border-none px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer self-end hover:bg-red-600"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-indigo-500 text-white border-none px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer self-end hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </footer>
    </div>
  )
}
