import { useState } from 'react'
import type { Provider } from '../types'

interface Props {
  onImport: (providers: Record<string, Provider>) => void
}

export function ImportSection({ onImport }: Props) {
  const [json, setJson] = useState('')
  const [status, setStatus] = useState<{ msg: string; error: boolean } | null>(null)

  const handleImport = () => {
    try {
      const raw = json.trim()
      if (!raw) return
      const data = JSON.parse(raw)

      const rawProviders = data.providers || data.provider || {}
      const result: Record<string, Provider> = {}

      for (const [id, p] of Object.entries<any>(rawProviders)) {
        let type: Provider['type'] = p.type || 'openai'
        if (!p.type && p.npm) {
          type = p.npm.includes('anthropic') ? 'anthropic' : 'openai'
        }

        const baseUrl = p.baseUrl || p.base_url || p.options?.baseURL || p.options?.baseUrl || ''
        const apiKey = p.apiKey || p.api_key || p.options?.apiKey || ''

        const headers: Record<string, string> = { ...(p.headers || {}) }
        if (p.options) {
          for (const [k, v] of Object.entries(p.options)) {
            if (!['baseURL', 'baseUrl', 'apiKey', 'api_key'].includes(k)) {
              headers[k] = v as string
            }
          }
        }

        const models = Array.isArray(p.models)
          ? p.models
          : p.models && typeof p.models === 'object'
            ? Object.keys(p.models)
            : []

        result[id] = { name: p.name || id, type, baseUrl, apiKey, headers, models }
      }

      onImport(result)
      setJson('')
      setStatus({ msg: 'Imported & saved', error: false })
      setTimeout(() => setStatus(null), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setStatus({ msg: `Invalid JSON: ${msg}`, error: true })
      setTimeout(() => setStatus(null), 3000)
    }
  }

  return (
    <div>
      <h2 className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200 mb-1.5">Import JSON Config</h2>
      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-2">
        Paste a JSON config to bulk-import providers. Supports opencode and custom formats.
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={6}
        placeholder="Paste JSON here..."
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 px-3 py-2.5 text-[12px] font-mono resize-y focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none mb-2"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleImport}
          className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-none px-4 py-1.5 rounded-full text-[13px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
        >
          Import
        </button>
        {status && (
          <span className={`text-[12px] ${status.error ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
            {status.msg}
          </span>
        )}
      </div>
    </div>
  )
}
