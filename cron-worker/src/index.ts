/**
 * ACGTI Cron Worker
 * 定时任务：每 15 分钟重新计算排行榜统计，更新快照表，并清理限流表过期行
 *
 * 数据源为聚合表（archetype_counts / character_counts / daily_counts），
 * 不再扫描 submissions 原始明细表。
 */

interface Env {
  DB: D1Database
  /** 配置后 /trigger 手动入口要求 Authorization: Bearer <secret> */
  CRON_TRIGGER_SECRET?: string
}

async function refreshAllSnapshots(db: D1Database) {
  // 1. 计算总体统计
  const overview = await calculateOverview(db)
  await updateSnapshot(db, 'overview', overview)

  // 2. 计算原型排行榜
  const archetypes = await calculateArchetypeStats(db, overview.totalSubmissions)
  await updateSnapshot(db, 'archetypes', archetypes)

  // 3. 计算角色排行榜（top 100）
  const characters = await calculateCharacterStats(db, overview.totalSubmissions)
  await updateSnapshot(db, 'characters', characters)
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    console.log(`[CRON] Starting stats snapshot calculation at ${new Date().toISOString()}`)

    try {
      await refreshAllSnapshots(env.DB)
      console.log(`[CRON] Successfully updated all snapshots`)
    } catch (error) {
      console.error(`[CRON] Error calculating stats:`, error)
    }

    // 清理限流表过期行：_rate_limit 只写不清会无限膨胀
    try {
      const cutoff = Math.floor(Date.now() / 1000) - 300
      await env.DB.prepare('DELETE FROM _rate_limit WHERE exp < ?').bind(cutoff).run()
    } catch (error) {
      console.warn('[CRON] Rate limit cleanup skipped:', error)
    }
  },

  // 支持手动测试触发；配置了 CRON_TRIGGER_SECRET 时要求 Bearer 鉴权，
  // 避免公开的 workers.dev 域名被任意调用消耗 D1 配额
  async fetch(request: Request, env: Env) {
    if (request.method === 'POST' && new URL(request.url).pathname === '/trigger') {
      if (env.CRON_TRIGGER_SECRET) {
        const expected = `Bearer ${env.CRON_TRIGGER_SECRET}`
        if (request.headers.get('Authorization') !== expected) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }

      try {
        await refreshAllSnapshots(env.DB)
        return new Response(JSON.stringify({ success: true, message: 'Snapshots updated manually' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('[CRON] Manual trigger failed:', error)
        return new Response(JSON.stringify({ error: 'internal' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response('Cron Worker is running', { status: 200 })
  },
}

/**
 * 计算总体统计：总提交数、今日提交数、24h 提交数
 * 优先从聚合表读取，聚合表不存在时降级到 submissions
 */
async function calculateOverview(db: D1Database) {
  const today = new Date().toISOString().slice(0, 10)

  try {
    // 从聚合表读：总数 = 所有 archetype_counts 的 cnt 之和
    const [totalResult, todayResult] = await Promise.all([
      db.prepare('SELECT COALESCE(SUM(cnt), 0) AS cnt FROM archetype_counts').first<{ cnt: number }>(),
      db.prepare('SELECT COALESCE(total_cnt, 0) AS cnt FROM daily_counts WHERE stat_date = ?').bind(today).first<{ cnt: number }>(),
    ])

    const totalSubmissions = totalResult?.cnt ?? 0
    const todaySubmissions = todayResult?.cnt ?? 0

    // 24h 数据：daily_counts 只有"日"粒度，实际统计口径为"今日 + 昨日两个自然日"
    // （凌晨时接近 48 小时、深夜时接近 24 小时），前端标签已按"近两日"展示
    const h24ago = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const h24Result = await db
      .prepare('SELECT COALESCE(SUM(total_cnt), 0) AS cnt FROM daily_counts WHERE stat_date >= ?')
      .bind(h24ago)
      .first<{ cnt: number }>()

    return {
      totalSubmissions,
      todaySubmissions,
      last24hSubmissions: h24Result?.cnt ?? 0,
    }
  } catch {
    // 聚合表可能不存在（migration 未执行），降级到旧表
    console.warn('[CRON] Aggregate tables not found, falling back to submissions table')
    return calculateOverviewFallback(db)
  }
}

/**
 * 降级方案：从 submissions 原始表统计
 */
async function calculateOverviewFallback(db: D1Database) {
  const today = new Date().toISOString().slice(0, 10)
  const h24ago = new Date(Date.now() - 86400000).toISOString()

  const [totalResult, todayResult, h24Result] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS cnt FROM submissions').first<{ cnt: number }>(),
    db.prepare('SELECT COUNT(*) AS cnt FROM submissions WHERE created_at >= ?').bind(today + 'T00:00:00Z').first<{ cnt: number }>(),
    db.prepare('SELECT COUNT(*) AS cnt FROM submissions WHERE created_at >= ?').bind(h24ago).first<{ cnt: number }>(),
  ])

  return {
    totalSubmissions: totalResult?.cnt ?? 0,
    todaySubmissions: todayResult?.cnt ?? 0,
    last24hSubmissions: h24Result?.cnt ?? 0,
  }
}

/**
 * 计算原型排行榜（含占比）
 * 优先从聚合表读取
 */
async function calculateArchetypeStats(db: D1Database, total: number) {
  try {
    const result = await db
      .prepare(
        `SELECT archetype_code AS code, cnt
         FROM archetype_counts
         ORDER BY cnt DESC`
      )
      .all<{ code: string; cnt: number }>()

    const items = (result.results ?? []).map((r) => ({
      code: r.code,
      count: r.cnt,
      percent: total > 0 ? Math.round((r.cnt / total) * 10000) / 100 : 0,
    }))

    return { items }
  } catch {
    console.warn('[CRON] archetype_counts not found, falling back to submissions GROUP BY')
    return calculateArchetypeStatsFallback(db, total)
  }
}

async function calculateArchetypeStatsFallback(db: D1Database, total: number) {
  const result = await db
    .prepare(
      `SELECT archetype_code, COUNT(*) AS cnt
       FROM submissions
       GROUP BY archetype_code
       ORDER BY cnt DESC`
    )
    .all<{ archetype_code: string; cnt: number }>()

  const items = (result.results ?? []).map((r) => ({
    code: r.archetype_code,
    count: r.cnt,
    percent: total > 0 ? Math.round((r.cnt / total) * 10000) / 100 : 0,
  }))

  return { items }
}

/**
 * 计算角色排行榜（全部角色，含占比）
 * 优先从聚合表读取
 */
async function calculateCharacterStats(db: D1Database, total: number) {
  try {
    const result = await db
      .prepare(
        `SELECT character_code AS code, cnt
         FROM character_counts
         ORDER BY cnt DESC
         LIMIT 200`
      )
      .all<{ code: string; cnt: number }>()

    const items = (result.results ?? []).map((r) => ({
      code: r.code,
      count: r.cnt,
      percent: total > 0 ? Math.round((r.cnt / total) * 10000) / 100 : 0,
    }))

    return { items }
  } catch {
    console.warn('[CRON] character_counts not found, falling back to submissions GROUP BY')
    return calculateCharacterStatsFallback(db, total)
  }
}

async function calculateCharacterStatsFallback(db: D1Database, total: number) {
  const result = await db
    .prepare(
      `SELECT character_code, COUNT(*) AS cnt
       FROM submissions
       GROUP BY character_code
       ORDER BY cnt DESC
       LIMIT 200`
    )
    .all<{ character_code: string; cnt: number }>()

  const items = (result.results ?? []).map((r) => ({
    code: r.character_code,
    count: r.cnt,
    percent: total > 0 ? Math.round((r.cnt / total) * 10000) / 100 : 0,
  }))

  return { items }
}

/**
 * 将结果写入快照表
 */
async function updateSnapshot(db: D1Database, key: string, data: any) {
  const valueJson = JSON.stringify(data)
  const updatedAt = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO stats_snapshot (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`
    )
    .bind(key, valueJson, updatedAt)
    .run()

  console.log(`[CRON] Updated snapshot: ${key}`)
}
