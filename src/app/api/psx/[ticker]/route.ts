import { type NextRequest } from 'next/server'
import { scrapeStockData } from '@/lib/psx/scraper'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params

  if (!ticker || ticker.length < 1 || ticker.length > 10) {
    return Response.json(
      { error: 'Invalid ticker symbol' },
      { status: 400 }
    )
  }

  const normalizedTicker = ticker.toUpperCase().trim()

  try {
    const supabase = await createClient()

    // Check cache first — return cached if updated within last 5 minutes
    const { data: cached } = await supabase
      .from('stocks')
      .select('*')
      .eq('symbol', normalizedTicker)
      .single()

    if (cached?.last_updated) {
      const cacheAge = Date.now() - new Date(cached.last_updated).getTime()
      if (cacheAge < 5 * 60 * 1000) {
        // Return cached data with CORS headers for future mobile app support
        return Response.json(
          {
            data: cached,
            source: 'cache',
            cached_at: cached.last_updated,
          },
          {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
              'Cache-Control': 'public, max-age=60',
            },
          }
        )
      }
    }

    // Scrape fresh data
    const stockData = await scrapeStockData(normalizedTicker)

    if (!stockData) {
      // If scraping failed but we have cached data, return stale cache
      if (cached) {
        return Response.json(
          {
            data: cached,
            source: 'stale-cache',
            cached_at: cached.last_updated,
          },
          {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
          }
        )
      }

      return Response.json(
        { error: `Could not fetch data for ${normalizedTicker}` },
        { status: 404 }
      )
    }

    // Upsert into stocks cache table
    const { error: upsertError } = await supabase
      .from('stocks')
      .upsert(
        {
          symbol: stockData.symbol,
          name: stockData.name,
          sector: stockData.sector,
          last_price: stockData.lastPrice,
          change: stockData.change,
          change_percent: stockData.changePercent,
          volume: stockData.volume,
          high: stockData.high,
          low: stockData.low,
          open: stockData.open,
          close: stockData.close,
          last_updated: stockData.lastUpdated,
        },
        { onConflict: 'symbol' }
      )

    if (upsertError) {
      console.error('Failed to upsert stock cache:', upsertError)
    }

    return Response.json(
      {
        data: {
          symbol: stockData.symbol,
          name: stockData.name,
          sector: stockData.sector,
          last_price: stockData.lastPrice,
          change: stockData.change,
          change_percent: stockData.changePercent,
          volume: stockData.volume,
          high: stockData.high,
          low: stockData.low,
          open: stockData.open,
          close: stockData.close,
          last_updated: stockData.lastUpdated,
        },
        source: 'live',
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'public, max-age=60',
        },
      }
    )
  } catch (error) {
    console.error(`API error for ${normalizedTicker}:`, error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
