// /api/stats/characters — 从快照表读取角色命中榜
// 快照表由 Cron Worker 每 15 分钟更新一次

import { json, readSnapshot } from '../_shared'

const FALLBACK_DATA = { items: [] as Array<{ code: string }> }

export async function onRequestGet(context: any) {
  const { DB } = context.env as { DB: D1Database }

  try {
    const { data, updatedAt } = await readSnapshot(DB, 'characters', FALLBACK_DATA)
    return json({ data, updatedAt }, 200, 'public, max-age=120')
  } catch (err) {
    console.error('Stats characters error:', err)
    return json({ error: 'internal' }, 500)
  }
}
