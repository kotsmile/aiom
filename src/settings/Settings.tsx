import { useState, useEffect } from 'react'
import type { Settings as SettingsType, Provider } from '../types'
import { getSettings, saveSettings } from '../lib/storage'
import { ProviderCard } from './ProviderCard'
import { VariablesSection } from './VariablesSection'
import { ImportSection } from './ImportSection'

export function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<string>('')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      setSavedSnapshot(JSON.stringify(s))
    })
  }, [])

  if (!settings) return null

  const dirty = JSON.stringify(settings) !== savedSnapshot

  const providers = settings.providers
  const activeProvider = providers[settings.activeProvider]
  const models = activeProvider?.models || []

  const updateSettings = (patch: Partial<SettingsType>) => {
    setSettings({ ...settings, ...patch })
  }

  const updateProvider = (id: string, provider: Provider) => {
    updateSettings({ providers: { ...providers, [id]: provider } })
  }

  const deleteProvider = (id: string) => {
    const next = { ...providers }
    delete next[id]
    const patch: Partial<SettingsType> = { providers: next }
    if (settings.activeProvider === id) {
      const keys = Object.keys(next)
      patch.activeProvider = keys[0] || ''
      patch.activeModel = ''
    }
    updateSettings(patch)
  }

  const addProvider = () => {
    const id = `provider-${Date.now()}`
    updateSettings({
      providers: {
        ...providers,
        [id]: { name: 'New Provider', type: 'openai', baseUrl: '', apiKey: '', headers: {}, models: [] },
      },
    })
  }

  const handleImport = async (imported: Record<string, Provider>) => {
    const updated = { ...settings, providers: { ...providers, ...imported } }
    setSettings(updated)
    await saveSettings(updated)
    setSavedSnapshot(JSON.stringify(updated))
  }

  const handleSave = async () => {
    await saveSettings(settings)
    setSavedSnapshot(JSON.stringify(settings))
    setStatus('Saved!')
    setTimeout(() => setStatus(null), 2000)
  }

  return (
    <div className="max-w-[600px] mx-auto px-5 pb-10 font-sans">
      {/* Sticky header with Save */}
      <div className="sticky top-0 z-20 -mx-5 px-5 py-3 mb-6 flex items-center justify-between gap-3 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-[22px] font-bold text-orange-500 dark:text-orange-300">aiom Settings</h1>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-[12px] font-semibold text-orange-600 dark:text-orange-300">
              Unsaved changes
            </span>
          )}
          {status && (
            <span className="text-[13px] font-semibold text-emerald-600">{status}</span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty}
            className={
              dirty
                ? 'border-none px-5 py-2 rounded-md text-sm font-semibold cursor-pointer text-white bg-orange-500 hover:bg-orange-600 ring-2 ring-orange-300 dark:ring-orange-500/50 animate-pulse'
                : 'border-none px-5 py-2 rounded-md text-sm font-semibold cursor-default text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800'
            }
          >
            Save
          </button>
        </div>
      </div>

      {/* Active config */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-700 dark:text-zinc-200 mb-3">Active Configuration</h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[13px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">Provider</label>
            <select
              value={settings.activeProvider}
              onChange={(e) => {
                const newProvider = providers[e.target.value]
                updateSettings({
                  activeProvider: e.target.value,
                  activeModel: newProvider?.models[0] || '',
                })
              }}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 px-2.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {Object.entries(providers).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[13px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">Model</label>
            <select
              value={settings.activeModel}
              onChange={(e) => updateSettings({ activeModel: e.target.value })}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 px-2.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* System message */}
        <div className="mt-4">
          <label className="block text-[13px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">System Message</label>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-1.5">
            Sent with every chat as context (e.g. language preference, role, style).
          </p>
          <textarea
            value={settings.systemMessage}
            onChange={(e) => updateSettings({ systemMessage: e.target.value })}
            rows={3}
            placeholder='e.g. "Отвечай мне на русском" or "You are a senior engineer, be concise"'
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 px-2.5 py-2 text-sm resize-y focus:border-orange-500 focus:outline-none"
          />
        </div>
      </section>

      <hr className="border-zinc-200 dark:border-zinc-700 my-6" />

      {/* Providers */}
      <section className="mb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-700 dark:text-zinc-200">Providers</h2>
          <button
            onClick={addProvider}
            className="bg-orange-500 text-white border-none px-3 py-1 rounded text-[13px] font-semibold cursor-pointer hover:bg-orange-600"
          >
            + Add Provider
          </button>
        </div>
        {Object.entries(providers).map(([id, p]) => (
          <ProviderCard
            key={id}
            id={id}
            provider={p}
            onChange={(provider) => updateProvider(id, provider)}
            onDelete={() => deleteProvider(id)}
          />
        ))}
      </section>

      <hr className="border-zinc-200 dark:border-zinc-700 my-6" />

      {/* Variables */}
      <VariablesSection
        variables={settings.variables}
        onChange={(variables) => updateSettings({ variables })}
      />

      <hr className="border-zinc-200 dark:border-zinc-700 my-6" />

      {/* Import */}
      <ImportSection onImport={handleImport} />
    </div>
  )
}
