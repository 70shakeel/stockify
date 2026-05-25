import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPortfolios } from '@/actions/portfolios'
import { PortfoliosPanel } from '@/components/portfolios/PortfoliosPanel'

export const metadata = {
  title: 'Portfolios — Stockify',
}

export default async function PortfoliosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: portfolios } = await getPortfolios()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PortfoliosPanel initialPortfolios={portfolios} />
    </div>
  )
}
