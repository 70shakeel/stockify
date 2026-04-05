import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { Newspaper, ExternalLink, Clock } from 'lucide-react'
import { scrapePSXNews } from '@/lib/psx/scraper'

export async function NewsFeed() {
  const news = await scrapePSXNews()

  if (news.length === 0) {
    return (
      <Card className="text-center py-12">
        <Newspaper className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-400">No news available</p>
        <p className="text-xs text-zinc-600 mt-1">Check back later for PSX updates</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-200">PSX News</h3>
        </div>
        <Badge variant="info" pulse>LIVE</Badge>
      </div>

      <div className="space-y-2">
        {news.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <Card
              hover
              padding="sm"
              className={cn(
                'animate-fade-in opacity-0',
                `stagger-${Math.min(i + 1, 8)}`
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 group-hover:text-emerald-400 transition-colors line-clamp-2 leading-relaxed">
                    {item.title}
                  </p>
                  {item.date && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span className="text-xs text-zinc-600">
                        {new Date(item.date).toLocaleDateString('en-PK', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-zinc-700 group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5" />
              </div>
            </Card>
          </a>
        ))}
      </div>
    </div>
  )
}
