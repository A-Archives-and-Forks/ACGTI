# -*- coding: utf-8 -*-
"""题目健康度分析：基于反馈样本计算每题区分度与维度信度。

用途：
    从本地 SQLite（build_sqlite.py 产出的 analysis/acgti_feedback.db）读取
    带完整答题向量的 MBTI 反馈样本，计算：
    1. 每题与「所属维度其余题目总分」的校正题总相关
       （corrected item-total correlation），作为题目区分度指标；
    2. 四个维度（E_I / S_N / T_F / J_P）的 Cronbach alpha 信度；
    3. 汇总预警：区分度 < 0.2 标「预警」，0.2-0.3 标「偏弱」，
       alpha < 0.6 的维度标「建议复核」。

用法：
    python analysis/item_health.py --db analysis/acgti_feedback.db --out-dir analysis/reports

输出：
    analysis/reports/item_health.md           人读报表（表格 + 结论段落 + 方法说明）
    analysis/reports/item_discrimination.csv  逐题指标（question_id, dimension, n,
                                               discrimination, alpha_of_dimension）

注意：区分度与 alpha 均在按题目 sign 做方向校正（反向题转向）后计算，
否则反向计分题会以「负相关」形式污染指标，失去可解释性。
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from build_sqlite import table_exists


VALID_MBTI = {
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
}

# 维度固定展示顺序，与题库 dimension 字段取值一致
DIMENSIONS = ["E_I", "S_N", "T_F", "J_P"]

# 项目分析常用判级阈值（经典教育/心理测量惯例，见报表脚注说明）
DISCRIMINATION_WARN = 0.2   # 低于该值：题目与维度其余部分几乎无关，列入预警
DISCRIMINATION_WEAK = 0.3   # 介于 0.2-0.3：区分度偏弱，可观察
ALPHA_REVIEW = 0.6          # 维度信度低于该值：建议复核整个维度的题目组合


def parse_answers(value: Any) -> dict[str, float]:
    """解析 answers_json（兼容 list[{questionId, answerValue}] 与旧版 dict 两种格式）。"""
    try:
        parsed = json.loads(str(value))
    except (TypeError, json.JSONDecodeError):
        return {}

    if isinstance(parsed, dict):
        return {str(question_id): float(answer) for question_id, answer in parsed.items()}

    if isinstance(parsed, list):
        result: dict[str, float] = {}
        for item in parsed:
            if not isinstance(item, dict):
                continue
            question_id = item.get("questionId") or item.get("question_id") or item.get("id")
            answer_value = item.get("answerValue", item.get("answer_value"))
            if question_id is None or answer_value is None:
                continue
            result[str(question_id)] = float(answer_value)
        return result

    return {}


def load_questions(path: Path) -> pd.DataFrame:
    """读取题库，返回列：id / dimension / sign / text（保持题库文件顺序）。"""
    questions = pd.DataFrame(json.loads(path.read_text(encoding="utf-8")))
    questions["id"] = questions["id"].astype(str)
    questions["sign"] = questions["sign"].astype(int)
    bad_dims = sorted(set(questions["dimension"]) - set(DIMENSIONS))
    if bad_dims:
        raise RuntimeError(f"questions.json 存在未知维度取值: {bad_dims}")
    return questions[["id", "dimension", "sign", "text"]]


def build_answer_matrix(feedback: pd.DataFrame, questions: pd.DataFrame) -> pd.DataFrame:
    """构造样本 x 题目的答案矩阵，行=feedback_id，列=题库顺序的题目 id。

    值 = answerValue * sign：sign=-1 的反向题先转向，保证维度内所有题目同向，
    这是计算题总相关与 Cronbach alpha 的前提。
    未作答的题目为 NaN；反馈中出现但题库已移除的题目 id 会被丢弃并返回。
    """
    records: list[dict[str, float]] = []
    for value in feedback["answers_json"]:
        records.append(parse_answers(value))

    matrix = pd.DataFrame(records, index=feedback["feedback_id"].tolist())
    unknown = sorted(set(matrix.columns) - set(questions["id"]))
    if unknown:
        print(f"note: 反馈中存在题库以外的题目 id，已忽略: {', '.join(unknown)}")

    matrix = matrix.reindex(columns=questions["id"].tolist())
    signs = questions.set_index("id")["sign"]
    return matrix.mul(signs, axis=1)


def corrected_item_total(dim_matrix: pd.DataFrame) -> list[dict[str, Any]]:
    """计算单个维度内每题的校正题总相关（区分度）。

    对每题 q：rest = 其余题目总分（缺失题按 0 计入），再取 q 与 rest 的
    成对有效样本做 Pearson 相关。q 或 rest 一方无方差时相关无定义，标 None（N/A）。
    """
    rows: list[dict[str, Any]] = []
    for question_id in dim_matrix.columns:
        rest = dim_matrix.drop(columns=[question_id]).sum(axis=1, skipna=True)
        pair = pd.concat([dim_matrix[question_id], rest], axis=1, keys=["item", "rest"]).dropna()
        n = len(pair)
        discrimination = None
        if n >= 2 and pair["item"].nunique() > 1 and pair["rest"].nunique() > 1:
            corr = float(pair["item"].corr(pair["rest"]))
            if not np.isnan(corr):
                discrimination = corr
        rows.append({"question_id": question_id, "n": n, "discrimination": discrimination})
    return rows


def cronbach_alpha(dim_matrix: pd.DataFrame) -> tuple[float | None, int]:
    """计算维度 Cronbach alpha：k/(k-1) * (1 - sum(item_var)/total_var)。

    方差均取样本方差（ddof=1）；仅使用该维度题目全部作答的完整样本，
    避免缺失值混入后扭曲题目方差与总分方差的比例。
    """
    complete = dim_matrix.dropna()
    k = dim_matrix.shape[1]
    n = len(complete)
    if k < 2 or n < 2:
        return None, n

    item_var_sum = float(complete.var(axis=0, ddof=1).sum())
    total_var = float(complete.sum(axis=1).var(ddof=1))
    if total_var <= 0:
        return None, n
    return k / (k - 1) * (1 - item_var_sum / total_var), n


def grade_discrimination(value: float | None) -> str:
    if value is None:
        return "N/A"
    if value < DISCRIMINATION_WARN:
        return "预警"
    if value < DISCRIMINATION_WEAK:
        return "偏弱"
    return "正常"


def grade_alpha(value: float | None) -> str:
    if value is None:
        return "N/A"
    if value < ALPHA_REVIEW:
        return "建议复核"
    return "正常"


def fmt(value: float | None, digits: int = 3) -> str:
    return "N/A" if value is None else f"{value:.{digits}f}"


def render_markdown(
    item_table: pd.DataFrame,
    dim_table: pd.DataFrame,
    n_samples: int,
    min_samples: int,
    questions_path: str,
) -> str:
    """拼装 reports/item_health.md 的正文（表格 + 动态结论 + 方法说明脚注）。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    n_questions = item_table["question_id"].nunique()

    dim_lines = ["| 维度 | 题目数 | 完整样本 | alpha | 状态 |", "|---|---:|---:|---:|---|"]
    for _, row in dim_table.iterrows():
        dim_lines.append(
            f"| {row['dimension']} | {int(row['items'])} | {int(row['n'])} "
            f"| {fmt(row['alpha'])} | {row['status']} |"
        )

    item_lines = ["| 题目 | 维度 | n | 区分度 | 状态 |", "|---|---|---:|---:|---|"]
    for _, row in item_table.iterrows():
        item_lines.append(
            f"| {row['question_id']} | {row['dimension']} | {int(row['n'])} "
            f"| {fmt(row['discrimination'])} | {row['status']} |"
        )

    # 结论段落：按状态分组动态生成，负区分度单独点名（方向性问题比弱区分更严重）
    warn = item_table[item_table["status"] == "预警"]
    negative = warn[warn["discrimination"] < 0]
    weak = item_table[item_table["status"] == "偏弱"]
    unavailable = item_table[item_table["status"] == "N/A"]
    review = dim_table[dim_table["status"] == "建议复核"]

    conclusion: list[str] = []
    if warn.empty and weak.empty and review.empty and unavailable.empty:
        conclusion.append(
            f"所有 {n_questions} 道题的区分度均达到 {DISCRIMINATION_WEAK} 以上，"
            f"四个维度 alpha 均不低于 {ALPHA_REVIEW}，题库整体健康，暂无需修改题目。"
        )
    if not review.empty:
        dims = "、".join(review["dimension"].tolist())
        detail = "；".join(f"{r['dimension']}={fmt(r['alpha'])}" for _, r in review.iterrows())
        conclusion.append(
            f"**建议复核维度**：{dims}（alpha 低于 {ALPHA_REVIEW}，{detail}）。"
            f"该维度题目组合的内部一致性偏弱，优先检查是否有题面歧义或错位维度归属，"
            f"而不是急于调权重。"
        )
    if not warn.empty:
        ids = "、".join(warn["question_id"].tolist())
        conclusion.append(
            f"**区分度预警题目（<{DISCRIMINATION_WARN}）**：共 {len(warn)} 道（{ids}）。"
            f"这些题与所属维度其余题目几乎不相关，属于「答什么都行」的题，"
            f"建议优先复核题面表述或维度归属。"
        )
    if not negative.empty:
        ids = "、".join(negative["question_id"].tolist())
        conclusion.append(
            f"其中 {ids} 的区分度为负值，与所属维度方向相反，"
            f"优先检查题面含义与 sign 设置是否冲突。"
        )
    if not weak.empty:
        ids = "、".join(weak["question_id"].tolist())
        conclusion.append(
            f"**区分度偏弱题目（{DISCRIMINATION_WARN}-{DISCRIMINATION_WEAK}）**：共 {len(weak)} 道（{ids}）。"
            f"尚可保留，但建议持续观察，若后续仍无起色再考虑改写题面。"
        )
    if not unavailable.empty:
        ids = "、".join(unavailable["question_id"].tolist())
        conclusion.append(
            f"**N/A 题目**：{ids} 的答案在该样本中没有方差（几乎所有人选择了同一档），"
            f"无法计算区分度，需人工判断是否属于「天花板/地板效应」。"
        )
    conclusion.append(
        "以上结论仅服务于题库迭代，ACGTI 是娱乐向测试，"
        "这些指标不应被表述为专业心理测量结论。"
    )

    return f"""# ACGTI 题目健康度报告

> 生成时间：{now}
> 数据来源：mbti_feedback（answers_json 完整且 self_mbti 有效）
> 有效样本：{n_samples} 条（样本下限 {min_samples} 条）
> 题库：{questions_path}（{n_questions} 题）

---

## 一、维度信度（Cronbach alpha）

{chr(10).join(dim_lines)}

## 二、题目区分度（校正题总相关）

{chr(10).join(item_lines)}

## 三、结论与建议

{chr(10).join(f"- {line}" for line in conclusion)}

---

## 方法说明

1. **样本筛选**：取 `mbti_feedback` 中 `answers_json` 非空、且 `self_mbti` 为合法十六型之一的反馈；
   有效样本少于 {min_samples} 条时拒绝出报告——心理测量学项目分析通常要求至少 30 个有效样本
   （经典经验下限，见 Nunnally《Psychometric Theory》），样本更少时相关系数与 alpha 波动过大，结论不可靠。
2. **答案取值**：`answerValue` 为 -2 到 2 的五档同意度，按连续数值处理；反向题（sign=-1）
   已先乘以 sign 转向，保证维度内所有题目同向计分后再计算指标。
3. **区分度**：corrected item-total correlation，即每题与「所属维度其余题目总分」的 Pearson 相关
   （把该题从维度总分中剔除，避免该题自身方差虚高抬高相关）。答案或总分无方差的题目标 N/A。
4. **信度**：Cronbach alpha = k/(k-1) * (1 - sum(item_var)/total_var)，其中 k 为维度题目数，
   方差均为样本方差（ddof=1），仅使用该维度全部作答的完整样本计算。
5. **判级阈值**：区分度 < {DISCRIMINATION_WARN} 列「预警」、{DISCRIMINATION_WARN}-{DISCRIMINATION_WEAK} 列「偏弱」
   为经典项目分析惯例；alpha < {ALPHA_REVIEW} 列「建议复核」，0.6-0.7 为可接受下限区间，
   0.7 以上为常规量表可接受水平，本报告只做两级粗分。
6. **局限**：反馈样本为自愿提交，存在自选择偏差；区分度与 alpha 反映的是题目与维度
   其余题目的一致性，不能替代内容效度的人工评审。
"""


def render_insufficient_markdown(n_samples: int, min_samples: int) -> str:
    """样本不足时写入 reports/item_health.md 的说明，解释下限的心理测量学依据。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    return f"""# ACGTI 题目健康度报告

> 生成时间：{now}
> 状态：样本不足，未生成分析

当前可用样本 {n_samples} 条，低于项目分析下限 {min_samples} 条（可通过 --min-samples 调整）。

心理测量学中，题目项目分析（区分度、信度）通常要求至少 30 个有效样本
（Nunnally《Psychometric Theory》给出的经验下限）。样本更少时相关系数与
Cronbach alpha 的抽样误差极大，任何判级结论都不稳定。请先用
`analysis/export_feedback.ps1` 拉取最新数据并重建本地库后再运行本脚本。
"""


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compute item discrimination and dimension reliability from feedback answers.",
    )
    parser.add_argument("--db", type=Path, default=Path("analysis/acgti_feedback.db"))
    parser.add_argument("--out-dir", type=Path, default=Path("analysis/reports"))
    parser.add_argument(
        "--min-samples", type=int, default=30,
        help="Minimum usable samples to run item analysis (psychometric floor, default 30).",
    )
    parser.add_argument(
        "--questions", type=Path,
        default=Path(__file__).resolve().parent.parent / "src" / "data" / "questions.json",
        help="Path to questions.json for item-dimension mapping.",
    )
    args = parser.parse_args()

    if not args.db.exists():
        raise FileNotFoundError(f"database not found: {args.db}")
    if not args.questions.exists():
        raise FileNotFoundError(f"questions.json not found: {args.questions}")

    conn = sqlite3.connect(args.db)
    if not table_exists(conn, "mbti_feedback"):
        raise RuntimeError("mbti_feedback table was not found. Run build_sqlite.py first.")

    # 样本筛选：answers_json 非空 + self_mbti 为合法十六型
    feedback = pd.read_sql_query(
        """
        SELECT id AS feedback_id, UPPER(TRIM(self_mbti)) AS self_mbti, answers_json
        FROM mbti_feedback
        WHERE answers_json IS NOT NULL AND TRIM(answers_json) != ''
        """,
        conn,
    )
    conn.close()
    feedback = feedback[feedback["self_mbti"].isin(VALID_MBTI)].reset_index(drop=True)

    args.out_dir.mkdir(parents=True, exist_ok=True)

    if len(feedback) < args.min_samples:
        message = (
            f"样本不足：有效反馈 {len(feedback)} 条，低于心理测量学项目分析下限 "
            f"{args.min_samples} 条，已退出。"
        )
        (args.out_dir / "item_health.md").write_text(
            render_insufficient_markdown(len(feedback), args.min_samples),
            encoding="utf-8",
        )
        print(message)
        raise SystemExit(1)

    questions = load_questions(args.questions)
    matrix = build_answer_matrix(feedback, questions)

    # 逐维度计算 alpha 与每题区分度，维度内保持题库顺序
    dim_rows: list[dict[str, Any]] = []
    item_rows: list[dict[str, Any]] = []
    for dim in DIMENSIONS:
        dim_items = questions.loc[questions["dimension"] == dim, "id"].tolist()
        dim_matrix = matrix[dim_items]
        alpha, n_complete = cronbach_alpha(dim_matrix)
        dim_rows.append({
            "dimension": dim,
            "items": len(dim_items),
            "n": n_complete,
            "alpha": alpha,
            "status": grade_alpha(alpha),
        })
        for item in corrected_item_total(dim_matrix):
            item_rows.append({
                "question_id": item["question_id"],
                "dimension": dim,
                "n": item["n"],
                "discrimination": item["discrimination"],
                "alpha_of_dimension": alpha,
                "status": grade_discrimination(item["discrimination"]),
            })

    dim_table = pd.DataFrame(dim_rows)
    item_table = pd.DataFrame(item_rows)

    # 机器可读输出：每题一行，附带所属维度 alpha
    export = item_table[["question_id", "dimension", "n", "discrimination", "alpha_of_dimension"]].copy()
    export["discrimination"] = export["discrimination"].map(lambda v: fmt(v, 4))
    export["alpha_of_dimension"] = export["alpha_of_dimension"].map(lambda v: fmt(v, 4))
    export["n"] = export["n"].astype(int)
    export.to_csv(args.out_dir / "item_discrimination.csv", index=False, encoding="utf-8-sig")

    # 人读报表：题库路径显示为相对仓库根的路径，便于跨机器阅读
    repo_root = Path(__file__).resolve().parent.parent
    try:
        questions_display = str(args.questions.resolve().relative_to(repo_root)).replace("\\", "/")
    except ValueError:
        questions_display = str(args.questions)
    (args.out_dir / "item_health.md").write_text(
        render_markdown(item_table, dim_table, len(feedback), args.min_samples, questions_display),
        encoding="utf-8",
    )

    print(dim_table.to_string(index=False))
    counts = item_table["status"].value_counts().to_dict()
    print(f"item status: {counts}")
    print(f"reports: {args.out_dir / 'item_health.md'}, {args.out_dir / 'item_discrimination.csv'}")


if __name__ == "__main__":
    main()
