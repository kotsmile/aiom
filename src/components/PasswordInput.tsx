import { useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function PasswordInput({ value, onChange, placeholder, className }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative flex">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 pr-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 px-3 py-2 text-[13px] focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none ${className ?? ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer text-sm p-0.5"
        title="Toggle visibility"
      >
        {visible ? '🙈' : '👁'}
      </button>
    </div>
  )
}
