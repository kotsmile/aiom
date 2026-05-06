export interface Provider {
  name: string
  type: 'openai' | 'anthropic'
  baseUrl: string
  apiKey: string
  headers: Record<string, string>
  models: string[]
}

export type Mode = 'api' | 'native'
export type NativeSiteId = 'chatgpt' | 'claude' | 'gemini' | 'perplexity'

export interface Settings {
  providers: Record<string, Provider>
  activeProvider: string
  activeModel: string
  variables: Record<string, string>
  systemMessage: string
  mode: Mode
  nativeSite: NativeSiteId
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp: number
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
}
