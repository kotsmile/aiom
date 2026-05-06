import { useState, useEffect } from 'react'
import type { Settings as SettingsType, Provider, Mode, NativeSiteId } from '../types'
import { getSettings, saveSettings } from '../lib/storage'
import { NATIVE_SITES } from '../lib/nativeSites'
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
    setStatus('Saved')
    setTimeout(() => setStatus(null), 2000)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 font-sans text-[15px]">
      <div className="max-w-[640px] mx-auto px-4 pb-12">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 -mx-4 px-4 py-3 mb-6 flex items-center justify-between gap-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">aiom Settings</h1>
          <div className="flex items-center gap-3">
            {dirty && (
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400">Unsaved</span>
            )}
            {status && (
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400">{status}</span>
            )}
            <button
              onClick={handleSave}
              disabled={!dirty}
              className="border-none px-4 py-1.5 rounded-full text-[13px] font-medium cursor-pointer text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            >
              Save
            </button>
          </div>
        </div>

        {/* Mode */}
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200 mb-1.5">Mode</h2>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-2">
            <strong>API</strong>: chat in the side panel using your provider keys. <strong>Native</strong>: send selections to the AI site you already use (no API key needed).
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['api', 'native'] as Mode[]).map((m) => {
              const active = settings.mode === m
              return (
                <button
                  key={m}
                  onClick={() => updateSettings({ mode: m })}
                  className={`text-left rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                    active
                      ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                    {m === 'api' ? 'API' : 'Native sites'}
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {m === 'api' ? 'Direct API calls' : 'Drive ChatGPT, Claude, Gemini, Perplexity'}
                  </div>
                </button>
              )
            })}
          </div>
          {settings.mode === 'native' && (
            <div className="mt-3">
              <label className="block text-[12px] text-zinc-500 dark:text-zinc-400 mb-1">Default site</label>
              <select
                value={settings.nativeSite}
                onChange={(e) => updateSettings({ nativeSite: e.target.value as NativeSiteId })}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-[14px] focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none"
              >
                {NATIVE_SITES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* System message */}
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200 mb-1.5">System Message</h2>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-2">
            Sent with every chat as context (e.g. language preference, role, style).
          </p>
          <textarea
            value={settings.systemMessage}
            onChange={(e) => updateSettings({ systemMessage: e.target.value })}
            rows={3}
            placeholder='e.g. "Отвечай мне на русском" or "You are a senior engineer, be concise"'
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 px-3 py-2.5 text-[14px] resize-y focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none"
          />
        </section>

        {/* Providers */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">Providers</h2>
            <button
              onClick={addProvider}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-none px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
            >
              + Add provider
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

        {/* Variables */}
        <section className="mb-8">
          <VariablesSection
            variables={settings.variables}
            onChange={(variables) => updateSettings({ variables })}
          />
        </section>

        {/* Import */}
        <section>
          <ImportSection onImport={handleImport} />
        </section>
      </div>
    </div>
  )
}
