-- ACGTI 统计数据库初始化
-- 3 张表：提交记录、答题明细、用户反馈

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  app_version TEXT NOT NULL,
  archetype_code TEXT NOT NULL,
  character_code TEXT NOT NULL,
  ei_score REAL,
  sn_score REAL,
  tf_score REAL,
  jp_score REAL,
  duration_ms INTEGER
);

CREATE TABLE IF NOT EXISTS submission_answers (
  submission_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer_value INTEGER NOT NULL,
  PRIMARY KEY (submission_id, question_id)
);

CREATE TABLE IF NOT EXISTS mbti_feedback (
  id TEXT PRIMARY KEY,
  submission_id TEXT,
  created_at TEXT NOT NULL,
  app_version TEXT NOT NULL,
  self_mbti TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  note TEXT
);
-- 注意：answers_json / answer_count 由 0006 追加，0001 保持最初形态。
-- 已应用的迁移文件不可回改（不会被重放），否则全新环境按 0001 -> 0006
-- 顺序执行时会因重复列中断（此前的回改正是这个坑，此处恢复原状）。

-- 索引：加速按时间、原型、角色聚合查询
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_archetype ON submissions(archetype_code);
CREATE INDEX IF NOT EXISTS idx_submissions_character ON submissions(character_code);
CREATE INDEX IF NOT EXISTS idx_feedback_submission_id ON mbti_feedback(submission_id);
