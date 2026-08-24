/**
 * ACGTI Cron Worker
 * 定时任务：每 15 分钟重新计算排行榜统计，更新快照表，并清理限流表过期行
 *
 * 数据源为聚合表（archetype_counts / character_counts / daily_counts）。
 * 0007 迁移后 /api/submit 已不再写 submissions 原始明细表，因此不存在
 * 任何"回退读 submissions"的降级路径：聚合数据缺失说明迁移或 cron 未就绪，
 * 记录错误并跳过该快照写入（fail visible），绝不静默产出旧时代数据。
 */

interface Env {
  DB: D1Database
  /** 配置后 /trigger 手动入口要求 Authorization: Bearer <secret> */
  CRON_TRIGGER_SECRET?: string
}

/**
 * 恒定时间字符串比较，与主项目 functions/api/_shared.ts 的 tokenEquals 等价
 * （cron-worker 是独立项目，无法直接复用，内联同款实现）。
 * 避免普通 !== 的短路逐字符比较泄漏令牌前缀。
 */
async function tokenEquals(a: string, b: string): Promise<boolean> {
  if (!a || !b || a.length !== b.length) return false
  try {
    const enc = new TextEncoder()
    // timingSafeEqual 是 Workers 的非标准扩展，以可选成员探测，
    // 兼容无此扩展的类型环境（DOM lib）与运行时（Node）
    const subtle = crypto.subtle as SubtleCrypto & {
      timingSafeEqual?: (x: BufferSource, y: BufferSource) => boolean
    }
    if (typeof subtle.timingSafeEqual === 'function') {
      return subtle.timingSafeEqual(enc.encode(a), enc.encode(b))
    }
  } catch {
    // 比较异常时回退普通比较
  }
  return a === b
}

async function refreshAllSnapshots(db: D1Database) {
  // 1. 总提交数（三个快照共用占比分母）：archetype_counts 缺失说明迁移未执行，
  //    依赖它的全部快照都跳过写入，错误显式暴露在日志里
  let total: number
  try {
    total = await queryTotalSubmissions(db)
  } catch (error) {
    console.error('[CRON] archetype_counts not available, skipping all snapshots (run migrations first!):', error)
    return
  }

  // 2. 各快照独立计算与写入：单个失败只跳过自身，不影响其余快照
  await refreshSnapshot(db, 'overview', () => calculateOverview(db, total))
  await refreshSnapshot(db, 'archetypes', () => calculateArchetypeStats(db, total))
  await refreshSnapshot(db, 'characters', () => calculateCharacterStats(db, total))
}

/** 单个快照的"计算 + 写入"包装：失败记录错误并跳过（fail visible） */
async function refreshSnapshot(db: D1Database, key: string, calc: () => Promise<unknown>) {
  try {
    await updateSnapshot(db, key, await calc())
  } catch (error) {
    console.error(`[CRON] Failed to refresh "${key}" snapshot, skipping:`, error)
  }
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

  // 支持手动测试触发；要求 Bearer CRON_TRIGGER_SECRET 鉴权，
  // 避免公开的 workers.dev 域名被任意调用消耗 D1 配额。
  // secret 未配置时默认拒绝（fail-closed）：手动触发口子不应存在无鉴权形态
  async fetch(request: Request, env: Env) {
    if (request.method === 'POST' && new URL(request.url).pathname === '/trigger') {
      if (!env.CRON_TRIGGER_SECRET) {
        return new Response(
          JSON.stringify({ error: 'CRON_TRIGGER_SECRET is not configured; manual trigger is disabled' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      const bearerToken = (request.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/i)?.[1] || ''
      if (!(await tokenEquals(bearerToken, env.CRON_TRIGGER_SECRET))) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
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
  }
}

/** 总提交数：所有 archetype_counts 的 cnt 之和 */
async function queryTotalSubmissions(db: D1Database): Promise<number> {
  const row = await db
    .prepare('SELECT COALESCE(SUM(cnt), 0) AS cnt FROM archetype_counts')
    .first<{ cnt: number }>()
  return row?.cnt ?? 0
}

/**
 * 计算总体统计：总提交数、今日提交数、24h 提交数
 * （总数由调用方传入，避免与排行榜计算重复查询）
 */
async function calculateOverview(db: D1Database, total: number) {
  const today = new Date().toISOString().slice(0, 10)

  const todayResult = await db
    .prepare('SELECT COALESCE(total_cnt, 0) AS cnt FROM daily_counts WHERE stat_date = ?')
    .bind(today)
    .first<{ cnt: number }>()

  // 24h 数据：daily_counts 只有"日"粒度，实际统计口径为"今日 + 昨日两个自然日"
  // （凌晨时接近 48 小时、深夜时接近 24 小时），前端标签已按"近两日"展示
  const h24ago = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const h24Result = await db
    .prepare('SELECT COALESCE(SUM(total_cnt), 0) AS cnt FROM daily_counts WHERE stat_date >= ?')
    .bind(h24ago)
    .first<{ cnt: number }>()

  return {
    totalSubmissions: total,
    todaySubmissions: todayResult?.cnt ?? 0,
    last24hSubmissions: h24Result?.cnt ?? 0,
  }
}

/**
 * 计算原型排行榜（含占比）
 */
async function calculateArchetypeStats(db: D1Database, total: number) {
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
}

/**
 * 计算角色排行榜（top 200，含占比）
 */
async function calculateCharacterStats(db: D1Database, total: number) {
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
