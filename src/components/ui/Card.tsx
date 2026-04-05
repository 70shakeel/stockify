import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: 'accent' | 'danger' | null
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({
  children,
  className,
  hover = false,
  glow = null,
  padding = 'md',
}: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div
      className={cn(
        'bg-zinc-900 border border-zinc-800 rounded-xl',
        paddings[padding],
        hover && 'hover:border-zinc-700 hover:bg-zinc-900/80 transition-all duration-200 cursor-pointer',
        glow === 'accent' && 'glow-accent',
        glow === 'danger' && 'glow-danger',
        className
      )}
    >
      {children}
    </div>
  )
}
