-- 给 mbti_feedback 新增 predicted_mbti、archetype_code、character_code
-- 让每条 feedback 都能直接对比"系统预测 vs 用户自报"，不依赖 2% 抽样

ALTER TABLE mbti_feedback ADD COLUMN predicted_mbti TEXT;
ALTER TABLE mbti_feedback ADD COLUMN archetype_code TEXT;
ALTER TABLE mbti_feedback ADD COLUMN character_code TEXT;
