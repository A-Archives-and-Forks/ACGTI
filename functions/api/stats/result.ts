// /api/stats/result — 结果页专用统计接口
// 直接从聚合表和快照表读取，返回当前角色/原型的站内统计数据

import { isValidCode, json, readSnapshot } from '../_shared'

export async function onRequestGet(context: any) {
  const { DB } = context.env as { DB: D1Database }
  const { request } = context
  const url = new URL(request.url)
  const characterParam = (url.searchParams.get('character') ?? '').trim()
  const archetypeParam = (url.searchParams.get('archetype') ?? '').trim()

  if (!characterParam && !archetypeParam) {
    return json({ error: 'missing character or archetype param' }, 400)
  }

  // 白名单校验：与 submit/feedback 的 code 校验规则对齐。
  // 非法格式（超长、特殊字符）的参数按"该维度未指定"处理返回零值，
  // 不让任意形态的输入进入 D1 查询（查询本身已参数化，此处属防御纵深）
  const characterCode = isValidCode(characterParam) ? characterParam : ''
  const archetypeCode = isValidCode(archetypeParam) ? archetypeParam : ''

  try {
    // 1. 从 overview 快照拿 totalSubmissions 与快照更新时间
    const overview = await readSnapshot<{ totalSubmissions?: number }>(
      DB,
      'overview',
      { totalSubmissions: 0 },
    )
    const totalSubmissions = overview.data.totalSubmissions ?? 0
    const snapshotUpdatedAt = overview.updatedAt

    // 角色与原型两段统计逻辑完全对称（仅表名/列名/快照键不同），
    // 提取局部函数去重：聚合计数 → 百分比 → 快照排行算排名。
    // 表名/列名是字面量联合类型而非用户输入，拼 SQL 无注入风险
    async function queryEntityStats(
      countsTable: 'character_counts' | 'archetype_counts',
      codeColumn: 'character_code' | 'archetype_code',
      snapshotKey: 'characters' | 'archetypes',
      code: string,
    ): Promise<{ count: number; percent: number; rank: number | null }> {
      // 直接从聚合表读 count（表不存在时保持 0）
      let count = 0
      try {
        const row = await DB.prepare(
          `SELECT cnt FROM ${countsTable} WHERE ${codeColumn} = ?`
        ).bind(code).first<{ cnt: number }>()
        count = row?.cnt ?? 0
      } catch {
        // 表不存在
      }

      const percent = totalSubmissions > 0 && count > 0
        ? Math.round((count / totalSubmissions) * 10000) / 100
        : 0

      // 从快照排行算 rank（快照只存 top 200，超出则为 null）
      let rank: number | null = null
      if (count > 0) {
        try {
          const snapshot = await DB.prepare(
            'SELECT value_json FROM stats_snapshot WHERE key = ?'
          ).bind(snapshotKey).first<{ value_json: string }>()

          if (snapshot) {
            const items: Array<{ code: string }> = JSON.parse(snapshot.value_json).items ?? []
            const idx = items.findIndex((item) => item.code === code)
            rank = idx >= 0 ? idx + 1 : null
          }
        } catch {
          // 快照不存在
        }
      }

      return { count, percent, rank }
    }

    // 2/3. 查角色与原型数据（两维度独立，未指定的维度返回零值）
    const EMPTY_STATS = { count: 0, percent: 0, rank: null as number | null }
    const charStats = characterCode
      ? await queryEntityStats('character_counts', 'character_code', 'characters', characterCode)
      : EMPTY_STATS
    const archStats = archetypeCode
      ? await queryEntityStats('archetype_counts', 'archetype_code', 'archetypes', archetypeCode)
      : EMPTY_STATS

    // updatedAt 返回快照的真实更新时间（无快照时为 null），不再用响应生成时间冒充
    return json({
      data: {
        totalSubmissions,
        sameCharacterCount: charStats.count,
        sameCharacterPercent: charStats.percent,
        sameArchetypeCount: archStats.count,
        sameArchetypePercent: archStats.percent,
        characterRank: charStats.rank,
        archetypeRank: archStats.rank,
      },
      updatedAt: snapshotUpdatedAt,
    }, 200, 'public, max-age=300')
  } catch (err) {
    console.error('Stats result error:', err)
    return json({ error: 'internal' }, 500)
  }
}
