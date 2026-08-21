// /api/stats/result — 结果页专用统计接口
// 直接从聚合表和快照表读取，返回当前角色/原型的站内统计数据

function isStatsSnapshotTableMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /no such table:\s*stats_snapshot/i.test(msg)
}

export async function onRequestGet(context: any) {
  const { DB } = context.env as { DB: D1Database }
  const { request } = context
  const url = new URL(request.url)
  const characterCode = (url.searchParams.get('character') ?? '').trim()
  const archetypeCode = (url.searchParams.get('archetype') ?? '').trim()

  if (!characterCode && !archetypeCode) {
    return new Response(JSON.stringify({ error: 'missing character or archetype param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // 1. 从 overview 快照拿 totalSubmissions 与快照更新时间
    const overviewSnapshot = await DB.prepare(
      'SELECT value_json, updated_at FROM stats_snapshot WHERE key = ?'
    ).bind('overview').first<{ value_json: string; updated_at: string }>()

    let totalSubmissions = 0
    let snapshotUpdatedAt: string | null = null
    if (overviewSnapshot) {
      const overviewData = JSON.parse(overviewSnapshot.value_json)
      totalSubmissions = overviewData.totalSubmissions ?? 0
      snapshotUpdatedAt = overviewSnapshot.updated_at ?? null
    }

    // 如果快照没有数据，尝试从聚合表直接计算
    if (totalSubmissions === 0) {
      try {
        const totalResult = await DB.prepare(
          'SELECT COALESCE(SUM(cnt), 0) AS cnt FROM archetype_counts'
        ).first<{ cnt: number }>()
        totalSubmissions = totalResult?.cnt ?? 0
      } catch {
        // 聚合表不存在，保持 0
      }
    }

    // 2. 查角色数据：从 character_counts 聚合表 + 快照排行算排名
    let sameCharacterCount = 0
    let sameCharacterPercent = 0
    let characterRank: number | null = null

    if (characterCode) {
      // 直接从聚合表读 count
      try {
        const charRow = await DB.prepare(
          'SELECT cnt FROM character_counts WHERE character_code = ?'
        ).bind(characterCode).first<{ cnt: number }>()
        sameCharacterCount = charRow?.cnt ?? 0
      } catch {
        // 表不存在
      }

      if (totalSubmissions > 0 && sameCharacterCount > 0) {
        sameCharacterPercent = Math.round((sameCharacterCount / totalSubmissions) * 10000) / 100
      }

      // 从快照排行算 rank（快照只存 top 100，超出则为 null）
      if (sameCharacterCount > 0) {
        try {
          const charSnapshot = await DB.prepare(
            'SELECT value_json FROM stats_snapshot WHERE key = ?'
          ).bind('characters').first<{ value_json: string }>()

          if (charSnapshot) {
            const charData = JSON.parse(charSnapshot.value_json)
            const items: Array<{ code: string }> = charData.items ?? []
            const idx = items.findIndex((item) => item.code === characterCode)
            characterRank = idx >= 0 ? idx + 1 : null
          }
        } catch {
          // 快照不存在
        }
      }
    }

    // 3. 查原型数据：从 archetype_counts 聚合表 + 快照排行算排名
    let sameArchetypeCount = 0
    let sameArchetypePercent = 0
    let archetypeRank: number | null = null

    if (archetypeCode) {
      try {
        const archRow = await DB.prepare(
          'SELECT cnt FROM archetype_counts WHERE archetype_code = ?'
        ).bind(archetypeCode).first<{ cnt: number }>()
        sameArchetypeCount = archRow?.cnt ?? 0
      } catch {
        // 表不存在
      }

      if (totalSubmissions > 0 && sameArchetypeCount > 0) {
        sameArchetypePercent = Math.round((sameArchetypeCount / totalSubmissions) * 10000) / 100
      }

      // 从快照排行算 rank
      if (sameArchetypeCount > 0) {
        try {
          const archSnapshot = await DB.prepare(
            'SELECT value_json FROM stats_snapshot WHERE key = ?'
          ).bind('archetypes').first<{ value_json: string }>()

          if (archSnapshot) {
            const archData = JSON.parse(archSnapshot.value_json)
            const items: Array<{ code: string }> = archData.items ?? []
            const idx = items.findIndex((item) => item.code === archetypeCode)
            archetypeRank = idx >= 0 ? idx + 1 : null
          }
        } catch {
          // 快照不存在
        }
      }
    }

    // updatedAt 返回快照的真实更新时间（无快照时为 null），不再用响应生成时间冒充
    const updatedAt = snapshotUpdatedAt

    return new Response(JSON.stringify({
      data: {
        totalSubmissions,
        sameCharacterCount,
        sameCharacterPercent,
        sameArchetypeCount,
        sameArchetypePercent,
        characterRank,
        archetypeRank,
      },
      updatedAt,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (err) {
    if (isStatsSnapshotTableMissing(err)) {
      return new Response(JSON.stringify({
        data: {
          totalSubmissions: 0,
          sameCharacterCount: 0,
          sameCharacterPercent: 0,
          sameArchetypeCount: 0,
          sameArchetypePercent: 0,
          characterRank: null,
          archetypeRank: null,
        },
        updatedAt: null,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      })
    }

    console.error('Stats result error:', err)
    return new Response(JSON.stringify({ error: 'internal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
