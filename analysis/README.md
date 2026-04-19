# ACGTI Feedback 分析流水线

这个目录用于把 Cloudflare D1 里的匿名反馈数据下载到本地，并生成可指导题目权重、角色映射和版本回归的报表。

当前项目最适合的流程是：

```text
D1 导出 -> SQLite 落地 -> pandas 分析 -> 错配样本复核 -> 题目权重/角色映射微调 -> app_version 对比
```

## 1. 安装分析依赖

建议在仓库根目录建立 Python 虚拟环境：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r analysis\requirements.txt
```

`train_dimension_models.py` 需要 `scikit-learn`；如果暂时只跑导出和基础报表，`pandas` 就够用。

## 2. 导出远程 D1 数据

仓库的 D1 数据库名是 `acgti-stats`，绑定名是 `DB`。执行：

```powershell
.\analysis\export_feedback.ps1
```

脚本会在 `analysis/backup/` 下生成：

- `full_<date>.sql`：全库备份
- `mbti_feedback_data_<date>.sql`：反馈表数据
- `submissions_sampled_data_<date>.sql`：抽样提交数据
- `submission_answers_blob_data_<date>.sql`：抽样答案 blob
- 兼容旧 schema 的 `submissions_data_<date>.sql`、`submission_answers_data_<date>.sql`

优先保留全库备份。单表导出主要用于人工排查，不建议直接拿 SQL 文本做分析。

## 3. 构建本地 SQLite 并导出高价值 CSV

```powershell
python analysis\build_sqlite.py --sql analysis\backup\full_YYYY-MM-DD.sql --db analysis\acgti_feedback.db
```

脚本会导出：

- `analysis/reports/feedback_joined.csv`：反馈、预测 MBTI、角色代码、抽样维度分数的合并视图
- `analysis/reports/answers_from_feedback.csv`：反馈提交时保存的完整答题向量
- `analysis/reports/answers_from_sampled_blob.csv`：抽样提交表里的答题向量
- `analysis/reports/answers_from_legacy_rows.csv`：旧版一题一行表的答题向量

注意：`mbti_feedback` 已经冗余保存了 `predicted_mbti / archetype_code / character_code`，因此反馈分析优先使用反馈表自身快照；只有旧数据缺字段时才回退到 `submissions` 或 `submissions_sampled`。

## 4. 跑基础反馈报表

```powershell
python analysis\analyze_feedback.py --db analysis\acgti_feedback.db
```

输出在 `analysis/reports/`：

- `summary.csv`：全部反馈、高置信反馈、超高置信反馈的一致率
- `confusion_mbti_high_conf.csv`：高置信样本的 MBTI 混淆矩阵
- `mismatch_all.csv`：全部错配样本
- `mismatch_high_conf.csv`：高置信错配样本，优先人工复核
- `by_version.csv`：不同 `app_version` 的一致率对比
- `by_character.csv`：角色争议度
- `by_archetype.csv`：原型争议度
- `note_keywords.csv`：备注文本的粗粒度关键词统计

默认高置信阈值是 `confidence >= 4`，可调整：

```powershell
python analysis\analyze_feedback.py --db analysis\acgti_feedback.db --high-confidence 5
```

## 5. 生成题目权重参考

当高置信反馈样本足够后，运行：

```powershell
python analysis\train_dimension_models.py --db analysis\acgti_feedback.db
```

脚本会把反馈时保存的 `answers_json` 展开成题目特征，并分别训练四个二分类逻辑回归模型：

- `EI`
- `SN`
- `TF`
- `JP`

输出：

- `model_metrics.csv`：每个维度的样本量、验证集准确率
- `weights_EI.csv`、`weights_SN.csv`、`weights_TF.csv`、`weights_JP.csv`：题目权重参考

这些结果不能直接无脑替换线上题库。推荐用法是对照 `src/data/questions.json`：

- 权重方向是否与现有题目设计一致
- 某题是否对错误方向有强影响
- 某题是否几乎没有区分度
- 哪个维度需要优先改题文，而不是只改权重

## 6. 微调顺序建议

1. 先看 `summary.csv` 和 `by_version.csv`，判断版本是否整体变好。
2. 再看四维一致率，优先处理最差的一维。
3. 用 `mismatch_high_conf.csv` 复核具体错配样本，区分“MBTI 维度错”和“角色观感不贴”。
4. 用 `weights_*.csv` 找 5 到 10 道最可疑题，做小步权重或题文修改。
5. 用 `by_character.csv` 和 `by_archetype.csv` 调整争议角色排序与原型映射，避免把角色问题误归因到题目问题。

## 7. 数据边界

- 普通匿名提交主要适合做全站统计和角色分布观察。
- 真正适合题目校准的是带 `self_mbti + confidence + answers_json` 的反馈样本。
- 低置信反馈不要直接参与权重训练。
- 本项目是娱乐测试，不应把分析报表包装成心理诊断或专业评估。
