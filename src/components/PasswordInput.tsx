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
        className={`flex-1 pr-9 rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none ${className ?? ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-gray-400 hover:text-indigo-500 cursor-pointer text-base p-0.5"
        title="Toggle visibility"
      >
        {visible ? '🙈' : '👁'}
      </button>
    </div>
  )
}
