from __future__ import annotations

import argparse
import re
import sqlite3
from pathlib import Path

import pandas as pd

from build_sqlite import build_feedback_query, table_exists


VALID_MBTI = {
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
}

NOTE_KEYWORDS = [
    "不像", "很像", "贴", "不贴", "准确", "不准", "极端", "抽象", "看不懂",
    "二义", "角色", "题目", "MBTI", "mbti", "E", "I", "S", "N", "T", "F", "J", "P",
]


def score_to_mbti(row: pd.Series) -> str | None:
    scores = [row.get("ei_score"), row.get("sn_score"), row.get("tf_score"), row.get("jp_score")]
    if any(pd.isna(score) for score in scores):
        return None

    # 当前线上 submit 存的是 0-100 的倾向百分比，>=50 取前一个字母。
    # 旧表若存在负数分数，则 >=0 仍能兼容正负方向。
    threshold = 50 if all(float(score) >= 0 for score in scores) else 0
    return "".join([
        "E" if float(row["ei_score"]) >= threshold else "I",
        "S" if float(row["sn_score"]) >= threshold else "N",
        "T" if float(row["tf_score"]) >= threshold else "F",
        "J" if float(row["jp_score"]) >= threshold else "P",
    ])


def normalize_predicted(df: pd.DataFrame) -> pd.Series:
    direct = df["predicted_mbti"].fillna("").astype(str).str.upper().str.strip()
    valid_direct = direct.where(direct.isin(VALID_MBTI))
    fallback = df.apply(score_to_mbti, axis=1)
    return valid_direct.fillna(fallback)


def rate(series: pd.Series) -> float | None:
    if len(series) == 0:
        return None
    return float(series.mean())


def segment_row(name: str, df: pd.DataFrame) -> dict[str, object]:
    return {
        "segment": name,
        "n": len(df),
        "match_rate": rate(df["match"]),
        "EI_rate": rate(df["EI_match"]),
        "SN_rate": rate(df["SN_match"]),
        "TF_rate": rate(df["TF_match"]),
        "JP_rate": rate(df["JP_match"]),
    }


def keyword_report(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    notes = df["note"].fillna("").astype(str)
    for keyword in NOTE_KEYWORDS:
        count = notes.str.contains(re.escape(keyword), case=False, regex=True).sum()
        rows.append({"keyword": keyword, "count": int(count)})
    return pd.DataFrame(rows).sort_values("count", ascending=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze ACGTI MBTI feedback quality and mismatches.")
    parser.add_argument("--db", type=Path, default=Path("analysis/acgti_feedback.db"))
    parser.add_argument("--reports-dir", type=Path, default=Path("analysis/reports"))
    parser.add_argument("--high-confidence", type=int, default=4)
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    if not table_exists(conn, "mbti_feedback"):
        raise RuntimeError("mbti_feedback table was not found. Run build_sqlite.py first.")

    args.reports_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_sql_query(build_feedback_query(conn), conn)
    df["self_mbti"] = df["self_mbti"].fillna("").astype(str).str.upper().str.strip()
    df = df[df["self_mbti"].isin(VALID_MBTI)].copy()
    df["pred_mbti"] = normalize_predicted(df)
    df = df[df["pred_mbti"].isin(VALID_MBTI)].copy()

    df["match"] = df["pred_mbti"] == df["self_mbti"]
    for idx, dim in enumerate(["EI", "SN", "TF", "JP"]):
        df[f"{dim}_match"] = df["pred_mbti"].str[idx] == df["self_mbti"].str[idx]

    high = df[df["confidence"] >= args.high_confidence].copy()
    very_high = df[df["confidence"] >= 5].copy()

    summary = pd.DataFrame([
        segment_row("all", df),
        segment_row(f"confidence>={args.high_confidence}", high),
        segment_row("confidence>=5", very_high),
    ])
    summary.to_csv(args.reports_dir / "summary.csv", index=False, encoding="utf-8-sig")

    pd.crosstab(high["self_mbti"], high["pred_mbti"]).to_csv(
        args.reports_dir / "confusion_mbti_high_conf.csv",
        encoding="utf-8-sig",
    )
    df[~df["match"]].to_csv(args.reports_dir / "mismatch_all.csv", index=False, encoding="utf-8-sig")
    high[~high["match"]].to_csv(args.reports_dir / "mismatch_high_conf.csv", index=False, encoding="utf-8-sig")

    for group_col, file_name in [
        ("feedback_app_version", "by_version.csv"),
        ("character_code", "by_character.csv"),
        ("archetype_code", "by_archetype.csv"),
    ]:
        report = high.dropna(subset=[group_col]).groupby(group_col).agg(
            n=("feedback_id", "count"),
            match_rate=("match", "mean"),
            EI_rate=("EI_match", "mean"),
            SN_rate=("SN_match", "mean"),
            TF_rate=("TF_match", "mean"),
            JP_rate=("JP_match", "mean"),
        ).reset_index().sort_values(["n", "match_rate"], ascending=[False, True])
        report.to_csv(args.reports_dir / file_name, index=False, encoding="utf-8-sig")

    keyword_report(high).to_csv(args.reports_dir / "note_keywords.csv", index=False, encoding="utf-8-sig")

    print(summary.to_string(index=False))
    print(f"reports: {args.reports_dir}")


if __name__ == "__main__":
    main()
