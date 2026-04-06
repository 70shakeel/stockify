'use client'

import { useState } from 'react'
import { seedAllPSXSymbols } from '@/actions/stocks'
import { Database } from 'lucide-react'

export function SeedSymbolsButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [count, setCount] = useState(0)

  const handleSeed = async () => {
    setState('loading')
    const res = await seedAllPSXSymbols()
    if (res.error) {
      setState('error')
    } else {
      setCount(res.count)
      setState('done')
      // Auto-reset after 4 seconds
      setTimeout(() => setState('idle'), 4000)
    }
  }

  return (
    <button
      onClick={handleSeed}
      disabled={state === 'loading'}
      title="Sync all PSX listed symbols into the database for autocomplete"
      className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed border-zinc-700/50 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5"
    >
      {state === 'loading' ? (
        <>
          <div className="w-3 h-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          Syncing symbols…
        </>
      ) : state === 'done' ? (
        <>
          <Database className="w-3 h-3 text-emerald-400" />
          {count} symbols synced ✓
        </>
      ) : state === 'error' ? (
        <>
          <Database className="w-3 h-3 text-red-400" />
          Sync failed — retry?
        </>
      ) : (
        <>
          <Database className="w-3 h-3" />
          Sync PSX symbols
        </>
      )}
    </button>
  )
}
