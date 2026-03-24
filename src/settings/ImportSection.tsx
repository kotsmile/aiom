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
      setStatus({ msg: 'Imported & saved!', error: false })
      setTimeout(() => setStatus(null), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setStatus({ msg: `Invalid JSON: ${msg}`, error: true })
      setTimeout(() => setStatus(null), 3000)
    }
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-700 mb-3">Import JSON Config</h2>
      <p className="text-[13px] text-gray-500 mb-2">
        Paste a JSON config to bulk-import providers. Supports opencode and custom formats.
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={6}
        placeholder="Paste JSON here..."
        className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-xs font-mono resize-y focus:border-indigo-500 focus:outline-none mb-2"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleImport}
          className="bg-gray-500 text-white border-none px-4 py-2 rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-600"
        >
          Import
        </button>
        {status && (
          <span className={`text-sm font-semibold ${status.error ? 'text-red-500' : 'text-emerald-600'}`}>
            {status.msg}
          </span>
        )}
      </div>
    </section>
  )
}
