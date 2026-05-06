import { useState } from 'react'
import type { Provider } from '../types'
import { PasswordInput } from '../components/PasswordInput'

interface Props {
  id: string
  provider: Provider
  onChange: (provider: Provider) => void
  onDelete: () => void
}

export function ProviderCard({ provider, onChange, onDelete }: Props) {
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

  const inputCls = 'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 px-3 py-2 text-[13px] focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none'
  const smallInputCls = 'flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 px-2.5 py-1.5 text-[12px] focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none'

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 mb-2 bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-2 font-medium text-[14px] cursor-pointer select-none flex-1"
          onClick={() => setOpen(!open)}
        >
          <span className={`text-[10px] text-zinc-400 dark:text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <span className="text-zinc-900 dark:text-zinc-100">{provider.name}</span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
            {provider.type}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="bg-transparent border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-red-500 hover:border-red-500 dark:hover:text-red-400 dark:hover:border-red-500 px-2.5 py-1 rounded-full text-[12px] font-medium cursor-pointer transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Body */}
      {open && (
        <div className="space-y-3 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className="block text-[12px] font-medium text-zinc-600 dark:text-zinc-300 mb-1">Name</label>
              <input
                type="text"
                value={provider.name}
                onChange={(e) => update({ name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[12px] font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                Type
              </label>
              <select
                value={provider.type}
                onChange={(e) => update({ type: e.target.value as Provider['type'] })}
                className={inputCls}
              >
                <option value="openai">OpenAI-compatible</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-zinc-600 dark:text-zinc-300 mb-1">Base URL</label>
            <input
              type="text"
              value={provider.baseUrl}
              onChange={(e) => update({ baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-zinc-600 dark:text-zinc-300 mb-1">API Key</label>
            <PasswordInput
              value={provider.apiKey}
              onChange={(v) => update({ apiKey: v })}
              placeholder="Leave empty if using headers"
            />
          </div>

          {/* Headers */}
          <div>
            <label className="block text-[12px] font-medium text-zinc-600 dark:text-zinc-300 mb-1">
              Custom Headers
            </label>
            <div className="space-y-1.5">
              {Object.entries(provider.headers).map(([key, val], i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => setHeader(i, e.target.value, val)}
                    placeholder="Header name"
                    className={smallInputCls}
                  />
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => setHeader(i, key, e.target.value)}
                    placeholder="Header value"
                    className={smallInputCls}
                  />
                  <button
                    onClick={() => removeHeader(i)}
                    className="bg-transparent border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-red-500 hover:border-red-500 dark:hover:text-red-400 dark:hover:border-red-500 px-2 rounded-lg text-sm cursor-pointer transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => update({ headers: { ...provider.headers, '': '' } })}
              className="bg-transparent border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-2.5 py-1 rounded-full text-[12px] font-medium cursor-pointer mt-2 transition-colors"
            >
              + Add header
            </button>
          </div>

          {/* Models */}
          <div>
            <label className="block text-[12px] font-medium text-zinc-600 dark:text-zinc-300 mb-1.5">Models</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {provider.models.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-full pl-2.5 pr-1.5 py-0.5 text-[11px] font-mono"
                >
                  {m}
                  <span
                    onClick={() => update({ models: provider.models.filter((x) => x !== m) })}
                    className="cursor-pointer text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 text-sm leading-none"
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
                className={smallInputCls}
              />
              <button
                onClick={addModel}
                className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-none px-3 rounded-lg text-[12px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
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
