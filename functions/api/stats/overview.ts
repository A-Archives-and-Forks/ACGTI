// /api/stats/overview — 从快照表读取总提交数、今日提交数、24h 提交数
// 快照表由 Cron Worker 每 15 分钟更新一次

function isStatsSnapshotTableMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /no such table:\s*stats_snapshot/i.test(msg)
}

export async function onRequestGet(context: any) {
  const { DB } = context.env as { DB: D1Database }

  try {
    const snapshot = await DB.prepare(
      'SELECT value_json, updated_at FROM stats_snapshot WHERE key = ?'
    ).bind('overview').first<{ value_json: string; updated_at: string }>()

    if (!snapshot) {
      return new Response(JSON.stringify({
        data: {
          totalSubmissions: 0,
          todaySubmissions: 0,
          last24hSubmissions: 0,
        },
        updatedAt: null,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      })
    }

    const data = JSON.parse(snapshot.value_json)
    return new Response(JSON.stringify({
      data,
      updatedAt: snapshot.updated_at,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (err) {
    if (isStatsSnapshotTableMissing(err)) {
      return new Response(JSON.stringify({
        data: {
          totalSubmissions: 0,
          todaySubmissions: 0,
          last24hSubmissions: 0,
        },
        updatedAt: null,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      })
    }

    console.error('Stats overview error:', err)
    return new Response(JSON.stringify({ error: 'internal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
