import { useState, useEffect } from 'react'
import type { Settings as SettingsType, Provider } from '../types'
import { getSettings, saveSettings } from '../lib/storage'
import { ProviderCard } from './ProviderCard'
import { VariablesSection } from './VariablesSection'
import { ImportSection } from './ImportSection'

export function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  if (!settings) return null

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
  }

  const handleSave = async () => {
    await saveSettings(settings)
    setStatus('Saved!')
    setTimeout(() => setStatus(null), 2000)
  }

  return (
    <div className="max-w-[600px] mx-auto py-10 px-5 font-sans">
      <h1 className="text-[22px] font-bold text-indigo-500 mb-6">aiom Settings</h1>

      {/* Active config */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3">Active Configuration</h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[13px] font-semibold text-gray-600 mb-1">Provider</label>
            <select
              value={settings.activeProvider}
              onChange={(e) => {
                const newProvider = providers[e.target.value]
                updateSettings({
                  activeProvider: e.target.value,
                  activeModel: newProvider?.models[0] || '',
                })
              }}
              className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {Object.entries(providers).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[13px] font-semibold text-gray-600 mb-1">Model</label>
            <select
              value={settings.activeModel}
              onChange={(e) => updateSettings({ activeModel: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <hr className="border-gray-200 my-6" />

      {/* Providers */}
      <section className="mb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">Providers</h2>
          <button
            onClick={addProvider}
            className="bg-indigo-500 text-white border-none px-3 py-1 rounded text-[13px] font-semibold cursor-pointer hover:bg-indigo-600"
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

      <hr className="border-gray-200 my-6" />

      {/* Variables */}
      <VariablesSection
        variables={settings.variables}
        onChange={(variables) => updateSettings({ variables })}
      />

      <hr className="border-gray-200 my-6" />

      {/* Import */}
      <ImportSection onImport={handleImport} />

      {/* Save */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="bg-indigo-500 text-white border-none px-7 py-2.5 rounded-md text-sm font-semibold cursor-pointer hover:bg-indigo-600"
        >
          Save All
        </button>
        {status && <span className="text-sm font-semibold text-emerald-600">{status}</span>}
      </div>
    </div>
  )
}
