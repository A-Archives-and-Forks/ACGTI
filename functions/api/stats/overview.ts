// /api/stats/overview — 从快照表读取总提交数、今日提交数、近两日提交数
// 快照表由 Cron Worker 每 15 分钟更新一次

import { json, readSnapshot } from '../_shared'

const FALLBACK_DATA = {
  totalSubmissions: 0,
  todaySubmissions: 0,
  last24hSubmissions: 0,
}

export async function onRequestGet(context: any) {
  const { DB } = context.env as { DB: D1Database }

  try {
    const { data, updatedAt } = await readSnapshot(DB, 'overview', FALLBACK_DATA)
    return json({ data, updatedAt }, 200, 'public, max-age=60')
  } catch (err) {
    console.error('Stats overview error:', err)
    return json({ error: 'internal' }, 500)
  }
}
