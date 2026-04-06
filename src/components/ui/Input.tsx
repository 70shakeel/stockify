import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-zinc-300">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg border bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100',
              'placeholder:text-zinc-600 transition-all duration-200 [color-scheme:dark]',
              'border-zinc-700/50 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20',
              'focus:outline-none',
              'hover:border-zinc-600',
              icon ? 'pl-10' : '',
              error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : '',
              className
            )}
            {...props}
            onClick={(e) => {
              if (props.type === 'date' && 'showPicker' in HTMLInputElement.prototype) {
                try {
                  ;(e.target as HTMLInputElement).showPicker()
                } catch (err) {
                  // Ignore if already showing or unsupported
                }
              }
              props.onClick?.(e)
            }}
          />
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-1">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export { Input }
