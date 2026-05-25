'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  LineChart,
  ArrowLeftRight,
  TrendingUp,
  Newspaper,
  X,
  PieChart,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

const navItems = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/stocks', label: 'Stocks', icon: TrendingUp },
  { href: '/portfolio', label: 'Portfolio', icon: LineChart },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/profit-split', label: 'Profit Split', icon: PieChart },
  { href: '/portfolios', label: 'Portfolios', icon: Briefcase },
]

export function MobileNav() {
  const pathname = usePathname()
  const { isSidebarOpen, closeSidebar } = useAppStore()

  if (!isSidebarOpen) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <div className="absolute left-0 top-0 bottom-0 w-72 bg-zinc-950 border-r border-zinc-800 animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-zinc-100">
              Stock<span className="text-emerald-400">ify</span>
            </span>
          </div>
          <button
            onClick={closeSidebar}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Items */}
        <div className="px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-5 py-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">
            PSX Portfolio Manager
          </p>
          <p className="text-xs text-zinc-700 mt-0.5">
            For educational use only
          </p>
        </div>
      </div>
    </div>
  )
}
