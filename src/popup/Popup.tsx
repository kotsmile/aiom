import { useState, useEffect, useRef } from 'react'
import type { Chat, ChatMessage, Settings } from '../types'
import { Markdown } from '../components/Markdown'
import {
  getSettings,
  getChats,
  saveChats,
  getActiveChatId,
  saveActiveChatId,
  getPendingMessage,
  clearPendingMessage,
  newChatId,
} from '../lib/storage'
import { sendMessage } from '../lib/providers'

export function Popup() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const streamingTextRef = useRef<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeChat = chats.find((c) => c.id === activeChatId) || null

  useEffect(() => {
    ;(async () => {
      const s = await getSettings()
      setSettings(s)

      let loadedChats = await getChats()
      let activeId = await getActiveChatId()

      // Handle pending message — always create a new chat for it
      const pending = await getPendingMessage()
      if (pending) {
        await clearPendingMessage()
        try { chrome.action.setBadgeText({ text: '' }) } catch {}
        const chat = { ...createChat(), title: pending.title }
        loadedChats = [chat, ...loadedChats]
        activeId = chat.id
        setChats(loadedChats)
        setActiveChatId(activeId)
        await saveChats(loadedChats)
        await saveActiveChatId(activeId)
        doSend(pending.text, chat, loadedChats, s, pending.systemPrompt)
        return
      }

      // Ensure at least one chat exists
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
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight)
  }, [activeChat?.messages, sending, streamingText])

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

    // User sees just the text, but API gets systemPrompt + text if provided
    const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: Date.now() }
    const newMessages = [...chat.messages, userMsg]

    // Build API messages: prepend system prompt as a separate user message if provided
    const apiMessages: ChatMessage[] = systemPrompt
      ? [...chat.messages, { role: 'user' as const, content: `${systemPrompt}\n\n"${text.trim()}"`, timestamp: Date.now() }]
      : newMessages

    // Auto-title from first user message, but keep existing title if already set
    const title = chat.messages.length === 0 && chat.title === 'New chat'
      ? text.trim().slice(0, 40)
      : chat.title
    let updated = updateChat(chat.id, (c) => ({ ...c, messages: newMessages, title }), allChats)
    setChats(updated)
    setInput('')
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
        // Save partial response on stop
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
    if (settings && activeChat) doSend(input, activeChat, chats, settings)
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
    await saveChats(updated)
    await saveActiveChatId(chat.id)
    inputRef.current?.focus()
  }

  const handleSelectChat = async (id: string) => {
    setActiveChatId(id)
    setSidebarOpen(false)
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

  const provider = settings?.providers[settings.activeProvider]
  const modelLabel = provider ? `${provider.name} / ${settings!.activeModel}` : 'No provider'
  const noAuth = !provider || (!provider.apiKey && !Object.keys(provider.headers || {}).length)

  return (
    <div className="w-full h-screen min-w-[360px] min-h-[400px] flex text-sm text-gray-900 bg-gray-50 font-sans relative">
      {/* Sidebar */}
      <div
        className={`absolute inset-y-0 left-0 z-10 w-56 bg-gray-900 text-white flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-700">
          <span className="font-semibold text-sm">Chats</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="bg-transparent border-none text-gray-400 hover:text-white cursor-pointer text-lg p-0"
          >
            ✕
          </button>
        </div>
        <button
          onClick={handleNewChat}
          className="mx-2 mt-2 bg-indigo-500 hover:bg-indigo-600 text-white border-none px-3 py-1.5 rounded text-[13px] font-semibold cursor-pointer"
        >
          + New Chat
        </button>
        <div className="flex-1 overflow-y-auto mt-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center gap-1 px-3 py-2 cursor-pointer text-[13px] hover:bg-gray-800 ${
                chat.id === activeChatId ? 'bg-gray-800' : ''
              }`}
              onClick={() => handleSelectChat(chat.id)}
            >
              <span className="flex-1 truncate">{chat.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteChat(chat.id)
                }}
                className="opacity-0 group-hover:opacity-100 bg-transparent border-none text-gray-500 hover:text-red-400 cursor-pointer text-sm p-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-3.5 py-2.5 bg-indigo-500 text-white">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="bg-white/20 border-none text-white px-2 py-1 rounded text-[15px] cursor-pointer hover:bg-white/35 leading-none"
              title="Toggle chats"
            >
              ☰
            </button>
            <span className="font-bold text-base shrink-0">aiom</span>
            <span className="text-[11px] opacity-80 truncate">{modelLabel}</span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleNewChat}
              className="bg-white/20 border-none text-white px-2.5 py-1 rounded text-[13px] cursor-pointer hover:bg-white/35"
              title="New chat"
            >
              +
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
          {activeChat?.messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] px-3 py-2 rounded-xl leading-relaxed break-words ${
                msg.role === 'user'
                  ? 'self-end bg-indigo-500 text-white rounded-br-sm whitespace-pre-wrap'
                  : msg.role === 'error'
                    ? 'self-start bg-red-100 text-red-800 rounded-bl-sm whitespace-pre-wrap'
                    : 'self-start bg-gray-200 text-gray-900 rounded-bl-sm'
              }`}
            >
              {msg.role === 'assistant' ? <Markdown>{msg.content}</Markdown> : msg.content}
            </div>
          ))}
          {sending && streamingText !== null && streamingText.length > 0 && (
            <div className="max-w-[85%] self-start bg-gray-200 text-gray-900 px-3 py-2 rounded-xl rounded-bl-sm leading-relaxed break-words">
              <Markdown>{streamingText}</Markdown>
              <span className="inline-block w-1.5 h-4 bg-gray-500 ml-0.5 align-middle animate-pulse" />
            </div>
          )}
          {sending && (streamingText === null || streamingText.length === 0) && (
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

      {/* Overlay to close sidebar */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-5 bg-black/20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
