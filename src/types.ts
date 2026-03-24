export interface Provider {
  name: string
  type: 'openai' | 'anthropic'
  baseUrl: string
  apiKey: string
  headers: Record<string, string>
  models: string[]
}

export interface Settings {
  providers: Record<string, Provider>
  activeProvider: string
  activeModel: string
  variables: Record<string, string>
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp: number
}
