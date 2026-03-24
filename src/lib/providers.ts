import type { ChatMessage, Settings, Provider } from '../types'
import { resolveVars } from './storage'

interface StreamOptions {
  signal?: AbortSignal
  onChunk: (text: string) => void
}

async function readSSEStream(
  res: Response,
  extractContent: (parsed: any) => string | null,
  onChunk: (text: string) => void,
): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const content = extractContent(parsed)
        if (content) {
          full += content
          onChunk(full)
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return full
}

async function callOpenAICompatible(
  messages: { role: string; content: string }[],
  provider: Provider,
  model: string,
  options: StreamOptions,
): Promise<string> {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...provider.headers,
  }
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, stream: true }),
    signal: options.signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `${provider.name} error ${res.status}`)
  }

  return readSSEStream(
    res,
    (parsed) => parsed.choices?.[0]?.delta?.content || null,
    options.onChunk,
  )
}

async function callAnthropicCompatible(
  messages: { role: string; content: string }[],
  provider: Provider,
  model: string,
  options: StreamOptions,
  systemMessage?: string,
): Promise<string> {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/v1/messages`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    ...provider.headers,
  }
  if (provider.apiKey) {
    headers['x-api-key'] = provider.apiKey
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages,
      stream: true,
      ...(systemMessage ? { system: systemMessage } : {}),
    }),
    signal: options.signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `${provider.name} error ${res.status}`)
  }

  return readSSEStream(
    res,
    (parsed) => {
      if (parsed.type === 'content_block_delta') {
        return parsed.delta?.text || null
      }
      return null
    },
    options.onChunk,
  )
}

export async function sendMessage(
  chatHistory: ChatMessage[],
  settings: Settings,
  options: { signal?: AbortSignal; onChunk: (text: string) => void },
): Promise<string> {
  const { providers, activeProvider, activeModel, variables } = settings
  const rawProvider = providers[activeProvider]

  if (!rawProvider) {
    throw new Error(`Provider "${activeProvider}" not found. Open Settings to configure.`)
  }

  const vars = variables || {}
  const provider: Provider = {
    ...rawProvider,
    baseUrl: resolveVars(rawProvider.baseUrl, vars),
    apiKey: resolveVars(rawProvider.apiKey, vars),
    headers: Object.fromEntries(
      Object.entries(rawProvider.headers || {}).map(([k, v]) => [k, resolveVars(v, vars)]),
    ),
  }

  if (!provider.apiKey && !Object.keys(provider.headers).length) {
    throw new Error(`No API key or auth headers for "${provider.name}". Open Settings.`)
  }

  const messages = chatHistory.map(({ role, content }) => ({ role, content }))

  const systemMessage = settings.systemMessage?.trim() || undefined

  if (provider.type === 'anthropic') {
    return callAnthropicCompatible(messages, provider, activeModel, options, systemMessage)
  } else {
    // OpenAI-compatible: prepend as system role message
    if (systemMessage) {
      messages.unshift({ role: 'system', content: systemMessage })
    }
    return callOpenAICompatible(messages, provider, activeModel, options)
  }
}
