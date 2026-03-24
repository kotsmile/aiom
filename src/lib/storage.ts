import type { Settings, ChatMessage } from '../types'

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

export async function getChatHistory(): Promise<ChatMessage[]> {
  const { chatHistory } = await chrome.storage.local.get('chatHistory')
  return chatHistory || []
}

export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  await chrome.storage.local.set({ chatHistory: messages })
}

export async function clearChatHistory(): Promise<void> {
  await chrome.storage.local.remove('chatHistory')
}

export async function getPendingMessage(): Promise<string | null> {
  const { pendingMessage } = await chrome.storage.local.get('pendingMessage')
  return pendingMessage || null
}

export async function clearPendingMessage(): Promise<void> {
  await chrome.storage.local.remove('pendingMessage')
}

export function resolveVars(str: string, variables: Record<string, string>): string {
  if (!str) return str
  return str.replace(/\$\{(\w+)\}/g, (match, name) =>
    variables[name] !== undefined ? variables[name] : match
  )
}
