'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setLastViewedPortfolio } from '@/actions/partners'
import { getPortfolios, getSharedPortfolios } from '@/actions/portfolios'
import { useAppStore } from '@/store/useAppStore'
import { Briefcase, ChevronDown, Check, Lock, Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { Portfolio } from '@/lib/psx/types'

interface SharedPortfolio extends Portfolio {
  owner_name: string
  percentage: number
}

export function NavPortfolioSelector() {
  const router = useRouter()
  const { activePortfolioId, setActivePortfolioId } = useAppStore()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [ownPortfolios, setOwnPortfolios] = useState<Portfolio[]>([])
  const [sharedPortfolios, setSharedPortfolios] = useState<SharedPortfolio[]>([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const [{ data: own }, { data: shared }] = await Promise.all([
        getPortfolios(),
        getSharedPortfolios(),
      ])
      const ownList = own ?? []
      const sharedList = (shared ?? []) as SharedPortfolio[]
      setOwnPortfolios(ownList)
      setSharedPortfolios(sharedList)
      setLoaded(true)

      // Sync activePortfolioId from cookie if store is empty
      if (!activePortfolioId) {
        const cookieVal = document.cookie
          .split('; ')
          .find(row => row.startsWith('last_portfolio_id='))
          ?.split('=')[1]
        const allIds = [...ownList.map(p => p.id), ...sharedList.map(p => p.id)]
        if (cookieVal && allIds.includes(cookieVal)) {
          setActivePortfolioId(cookieVal)
        } else if (ownList.length > 0) {
          setActivePortfolioId(ownList[0].id)
        }
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const allPortfolios = [...ownPortfolios, ...sharedPortfolios]
  const active = allPortfolios.find(p => p.id === activePortfolioId)

  async function switchTo(id: string) {
    if (id === activePortfolioId) { setOpen(false); return }
    setSwitching(id)
    await setLastViewedPortfolio(id)
    setActivePortfolioId(id)
    setOpen(false)
    router.refresh()
    setSwitching(null)
  }

  if (!loaded || allPortfolios.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-medium',
          open
            ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
            : 'bg-zinc-900 border-zinc-700/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100'
        )}
      >
        {active ? (
          <div
            className="w-4 h-4 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: active.color + '30' }}
          >
            <Briefcase className="w-2.5 h-2.5" style={{ color: active.color }} />
          </div>
        ) : (
          <Briefcase className="w-4 h-4 text-zinc-500" />
        )}
        <span className="max-w-[120px] truncate hidden sm:block">
          {active?.name ?? 'Select Portfolio'}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-500 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-zinc-700/60 bg-zinc-900 shadow-2xl shadow-black/50 overflow-hidden z-50">
          {ownPortfolios.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Your Portfolios</p>
              {ownPortfolios.map(p => (
                <button
                  key={p.id}
                  onClick={() => switchTo(p.id)}
                  disabled={!!switching}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: p.color + '30' }}
                  >
                    <Briefcase className="w-3 h-3" style={{ color: p.color }} />
                  </div>
                  <span className={cn('flex-1 text-sm text-left truncate', p.id === activePortfolioId ? 'text-zinc-100 font-medium' : 'text-zinc-400')}>
                    {p.name}
                  </span>
                  {p.id === activePortfolioId && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {switching === p.id && <div className="w-3.5 h-3.5 border border-zinc-500 border-t-zinc-300 rounded-full animate-spin shrink-0" />}
                </button>
              ))}
            </>
          )}

          {sharedPortfolios.length > 0 && (
            <>
              <p className={cn('px-3 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider', ownPortfolios.length > 0 ? 'pt-2 border-t border-zinc-800 mt-1' : 'pt-3')}>Shared With Me</p>
              {sharedPortfolios.map(p => (
                <button
                  key={p.id}
                  onClick={() => switchTo(p.id)}
                  disabled={!!switching}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: p.color + '30' }}
                  >
                    <Lock className="w-3 h-3" style={{ color: p.color }} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={cn('text-sm truncate', p.id === activePortfolioId ? 'text-zinc-100 font-medium' : 'text-zinc-400')}>{p.name}</p>
                    <p className="text-[10px] text-zinc-600 truncate">by {(p as SharedPortfolio).owner_name}</p>
                  </div>
                  {p.id === activePortfolioId && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {switching === p.id && <div className="w-3.5 h-3.5 border border-zinc-500 border-t-zinc-300 rounded-full animate-spin shrink-0" />}
                </button>
              ))}
            </>
          )}

          <div className="p-2 border-t border-zinc-800 mt-1 space-y-0.5">
            <Link
              href="/portfolios"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Manage Portfolios
            </Link>
            <Link
              href="/portfolios"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Portfolio
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
