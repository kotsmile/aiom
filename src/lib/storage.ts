import type { Settings, Chat } from '../types'

const DEFAULT_SETTINGS: Settings = {
  providers: {
    openai: {
      name: 'OpenAI',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      headers: {},
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-nano'],
    },
    anthropic: {
      name: 'Anthropic',
      type: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: '',
      headers: {},
      models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
    },
  },
  activeProvider: 'openai',
  activeModel: 'gpt-4o-mini',
  variables: {},
  systemMessage: '',
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings')
  if (!settings) return structuredClone(DEFAULT_SETTINGS)
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    providers: { ...DEFAULT_SETTINGS.providers, ...settings.providers },
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings })
}

// --- Chats ---

export function newChatId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export async function getChats(): Promise<Chat[]> {
  const { chats } = await chrome.storage.local.get('chats')
  return chats || []
}

export async function saveChats(chats: Chat[]): Promise<void> {
  await chrome.storage.local.set({ chats })
}

export async function getActiveChatId(): Promise<string | null> {
  const { activeChatId } = await chrome.storage.local.get('activeChatId')
  return activeChatId || null
}

export async function saveActiveChatId(id: string): Promise<void> {
  await chrome.storage.local.set({ activeChatId: id })
}

// --- Pending message ---

export interface PendingMessage {
  text: string
  title: string
  systemPrompt?: string
}

export async function getPendingMessage(): Promise<PendingMessage | null> {
  const { pendingMessage } = await chrome.storage.local.get('pendingMessage')
  if (!pendingMessage) return null
  if (typeof pendingMessage === 'string') return { text: pendingMessage, title: pendingMessage.slice(0, 40) }
  return pendingMessage
}

export async function clearPendingMessage(): Promise<void> {
  await chrome.storage.local.remove('pendingMessage')
}

// --- Helpers ---

export function resolveVars(str: string, variables: Record<string, string>): string {
  if (!str) return str
  return str.replace(/\$\{(\w+)\}/g, (match, name) =>
    variables[name] !== undefined ? variables[name] : match
  )
}
