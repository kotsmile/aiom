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

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-700">Variables</h2>
        <button
          onClick={add}
          className="bg-indigo-500 text-white border-none px-3 py-1 rounded text-[13px] font-semibold cursor-pointer hover:bg-indigo-600"
        >
          + Add Variable
        </button>
      </div>
      <p className="text-[13px] text-gray-500 mb-2">
        Define variables to use as <code className="bg-gray-100 px-1 rounded text-xs">{`\${VAR_NAME}`}</code> in API keys, base URLs, and headers.
      </p>
      <div className="space-y-1.5">
        {entries.map(([key, val], i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <input
              type="text"
              value={key}
              onChange={(e) => update(i, e.target.value, val)}
              placeholder="VAR_NAME"
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex-1">
              <PasswordInput
                value={val}
                onChange={(v) => update(i, key, v)}
                placeholder="value"
                className="!text-xs !py-1"
              />
            </div>
            <button
              onClick={() => remove(i)}
              className="bg-gray-100 text-gray-500 border border-gray-300 px-2 py-1 rounded text-xs cursor-pointer hover:bg-red-50 hover:text-red-500 hover:border-red-500"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
