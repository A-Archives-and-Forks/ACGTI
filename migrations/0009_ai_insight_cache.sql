-- 0009: AI 结果解读缓存表
-- /api/insight 以「角色代码 + 四维倾向分桶 + 语言」为缓存键，
-- 相同画像的后续请求直接命中，把 Workers AI 的 Neurons 消耗压到常数级。
CREATE TABLE IF NOT EXISTS ai_insight_cache (
  cache_key  TEXT PRIMARY KEY,
  text       TEXT NOT NULL,
  model      TEXT NOT NULL,
  lang       TEXT NOT NULL,
  hits       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_insight_cache_updated
  ON ai_insight_cache (updated_at);
