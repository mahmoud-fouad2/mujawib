'use client'

import { Eye, EyeOff } from 'lucide-react'
import { type InputHTMLAttributes, useState } from 'react'

export function PasswordField({
  className = 'input',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  const label = visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'

  return (
    <div className="password-control">
      <input {...props} className={className} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-control__toggle"
        aria-label={label}
        aria-pressed={visible}
        title={label}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
  )
}
