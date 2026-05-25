import { InviteFlow } from './InviteFlow'

interface Props {
  params: Promise<{ token: string }>
}

export const metadata = { title: 'Accept Invitation — Stockify' }

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <InviteFlow token={token} />
    </div>
  )
}
