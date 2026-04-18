-- ACGTI 聚合计数表
-- 每次 submit 只做 UPSERT 自增，不再全量写 submissions 明细
-- 原始提交改为 2% 抽样存入 submissions_sampled

-- 原型计数
CREATE TABLE IF NOT EXISTS archetype_counts (
  archetype_code TEXT PRIMARY KEY,
  cnt INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 角色计数
CREATE TABLE IF NOT EXISTS character_counts (
  character_code TEXT PRIMARY KEY,
  cnt INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 原型+角色组合计数
CREATE TABLE IF NOT EXISTS pair_counts (
  archetype_code TEXT NOT NULL,
  character_code TEXT NOT NULL,
  cnt INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (archetype_code, character_code)
);

-- 每日计数
CREATE TABLE IF NOT EXISTS daily_counts (
  stat_date TEXT PRIMARY KEY,
  total_cnt INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 抽样明细表：只保留少量原始提交，用于校准和排查
CREATE TABLE IF NOT EXISTS submissions_sampled (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  app_version TEXT NOT NULL,
  archetype_code TEXT NOT NULL,
  character_code TEXT NOT NULL,
  ei_score INTEGER,
  sn_score INTEGER,
  tf_score INTEGER,
  jp_score INTEGER,
  duration_ms INTEGER,
  predicted_mbti TEXT
);

-- 抽样答案 blob：只对抽样样本保存答案 JSON
CREATE TABLE IF NOT EXISTS submission_answers_blob (
  submission_id TEXT PRIMARY KEY,
  answers_json TEXT NOT NULL
);
