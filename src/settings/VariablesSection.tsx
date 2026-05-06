import { PasswordInput } from '../components/PasswordInput'

interface Props {
  variables: Record<string, string>
  onChange: (variables: Record<string, string>) => void
}

export function VariablesSection({ variables, onChange }: Props) {
  const entries = Object.entries(variables)

  const update = (index: number, key: string, value: string) => {
    const newEntries = [...entries]
    newEntries[index] = [key, value]
    onChange(Object.fromEntries(newEntries.filter(([k]) => k !== '')))
  }

  const remove = (index: number) => {
    const newEntries = [...entries]
    newEntries.splice(index, 1)
    onChange(Object.fromEntries(newEntries))
  }

  const add = () => {
    onChange({ ...variables, [`VAR_${Date.now()}`]: '' })
  }

  const inputCls = 'flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 px-2.5 py-1.5 text-[12px] focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">Variables</h2>
        <button
          onClick={add}
          className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-none px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
        >
          + Add variable
        </button>
      </div>
      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-2.5">
        Define variables to use as <code className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-1 rounded text-[11px]">{`\${VAR_NAME}`}</code> in API keys, base URLs, and headers.
      </p>
      <div className="space-y-1.5">
        {entries.map(([key, val], i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <input
              type="text"
              value={key}
              onChange={(e) => update(i, e.target.value, val)}
              placeholder="VAR_NAME"
              className={inputCls}
            />
            <div className="flex-1">
              <PasswordInput
                value={val}
                onChange={(v) => update(i, key, v)}
                placeholder="value"
                className="!text-[12px] !py-1.5"
              />
            </div>
            <button
              onClick={() => remove(i)}
              className="bg-transparent border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-red-500 hover:border-red-500 dark:hover:text-red-400 dark:hover:border-red-500 px-2 py-1 rounded-lg text-sm cursor-pointer transition-colors"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
