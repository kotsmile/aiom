import type { NativeSiteId } from '../types'

export interface NativeSite {
  id: NativeSiteId
  label: string
  embedUrl: string
}

export const NATIVE_SITES: NativeSite[] = [
  { id: 'chatgpt', label: 'ChatGPT', embedUrl: 'https://chatgpt.com/' },
  { id: 'claude', label: 'Claude', embedUrl: 'https://claude.ai/new' },
  { id: 'gemini', label: 'Gemini', embedUrl: 'https://gemini.google.com/app' },
  { id: 'perplexity', label: 'Perplexity', embedUrl: 'https://www.perplexity.ai/' },
]

export function nativeSiteLabel(id: NativeSiteId): string {
  return NATIVE_SITES.find((s) => s.id === id)?.label ?? id
}

export function nativeSiteEmbedUrl(id: NativeSiteId): string {
  return NATIVE_SITES.find((s) => s.id === id)?.embedUrl ?? 'https://chatgpt.com/'
}
