import { useState } from 'react'
import type { Provider } from '../types'
import { PasswordInput } from '../components/PasswordInput'

interface Props {
  id: string
  provider: Provider
  onChange: (provider: Provider) => void
  onDelete: () => void
}

export function ProviderCard({ id, provider, onChange, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [newModel, setNewModel] = useState('')

  const update = (patch: Partial<Provider>) => onChange({ ...provider, ...patch })

  const setHeader = (index: number, key: string, value: string) => {
    const entries = Object.entries(provider.headers)
    entries[index] = [key, value]
    update({ headers: Object.fromEntries(entries.filter(([k]) => k !== '')) })
  }

  const removeHeader = (index: number) => {
    const entries = Object.entries(provider.headers)
    entries.splice(index, 1)
    update({ headers: Object.fromEntries(entries) })
  }

  const addModel = () => {
    const name = newModel.trim()
    if (name && !provider.models.includes(name)) {
      update({ models: [...provider.models, name] })
      setNewModel('')
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div
          className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none"
          onClick={() => setOpen(!open)}
        >
          <span className={`text-xs text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <span>{provider.name}</span>
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
            {provider.type}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="bg-red-500 text-white border-none px-3 py-1 rounded text-[13px] font-semibold cursor-pointer hover:bg-red-600"
        >
          Delete
        </button>
      </div>

      {/* Body */}
      {open && (
        <div className="space-y-3">
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className="block text-[13px] font-semibold text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={provider.name}
                onChange={(e) => update({ name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[13px] font-semibold text-gray-600 mb-1">
                Type (API format)
              </label>
              <select
                value={provider.type}
                onChange={(e) => update({ type: e.target.value as Provider['type'] })}
                className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="openai">OpenAI-compatible</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-600 mb-1">Base URL</label>
            <input
              type="text"
              value={provider.baseUrl}
              onChange={(e) => update({ baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-600 mb-1">API Key</label>
            <PasswordInput
              value={provider.apiKey}
              onChange={(v) => update({ apiKey: v })}
              placeholder="Leave empty if using headers"
            />
          </div>

          {/* Headers */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-600 mb-1">
              Custom Headers
            </label>
            {Object.entries(provider.headers).map(([key, val], i) => (
              <div key={i} className="flex gap-1.5 mb-1">
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setHeader(i, e.target.value, val)}
                  placeholder="Header name"
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={val}
                  onChange={(e) => setHeader(i, key, e.target.value)}
                  placeholder="Header value"
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={() => removeHeader(i)}
                  className="bg-gray-100 text-gray-500 border border-gray-300 px-2 py-1 rounded text-xs cursor-pointer hover:bg-red-50 hover:text-red-500 hover:border-red-500"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => update({ headers: { ...provider.headers, '': '' } })}
              className="bg-gray-500 text-white border-none px-3 py-1 rounded text-[13px] font-semibold cursor-pointer hover:bg-gray-600 mt-1"
            >
              + Add Header
            </button>
          </div>

          {/* Models */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-600 mb-1">Models</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {provider.models.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 bg-gray-100 border border-gray-300 rounded px-2 py-0.5 text-xs font-mono"
                >
                  {m}
                  <span
                    onClick={() => update({ models: provider.models.filter((x) => x !== m) })}
                    className="cursor-pointer text-gray-400 hover:text-red-500 text-sm leading-none"
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addModel()
                  }
                }}
                placeholder="model-name"
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={addModel}
                className="bg-indigo-500 text-white border-none px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-indigo-600"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
