from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

import pandas as pd


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def columns(conn: sqlite3.Connection, table: str) -> set[str]:
    if not table_exists(conn, table):
        return set()
    return {str(row[1]) for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def load_sql_dump(sql_path: Path, db_path: Path, rebuild: bool) -> sqlite3.Connection:
    if rebuild and db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    if sql_path:
        script = sql_path.read_text(encoding="utf-8")
        conn.executescript(script)
        conn.commit()
    return conn


def coalesce_expr(candidates: list[tuple[str, str]], schema: dict[str, set[str]], fallback: str = "NULL") -> str:
    exprs = [f"{alias}.{col}" for alias, col in candidates if col in schema.get(alias, set())]
    if not exprs:
        return fallback
    if len(exprs) == 1:
        return exprs[0]
    return f"COALESCE({', '.join(exprs)})"


def build_feedback_query(conn: sqlite3.Connection) -> str:
    schema = {
        "f": columns(conn, "mbti_feedback"),
        "s": columns(conn, "submissions"),
        "ss": columns(conn, "submissions_sampled"),
    }

    joins: list[str] = []
    if table_exists(conn, "submissions"):
        joins.append("LEFT JOIN submissions s ON f.submission_id = s.id")
    if table_exists(conn, "submissions_sampled"):
        joins.append("LEFT JOIN submissions_sampled ss ON f.submission_id = ss.id")

    select = [
        "f.id AS feedback_id",
        "f.submission_id",
        "f.created_at AS feedback_time",
        "f.app_version AS feedback_app_version",
        "UPPER(TRIM(f.self_mbti)) AS self_mbti",
        "f.confidence",
        "f.note",
        "f.answers_json",
        "f.answer_count",
        f"{coalesce_expr([('f', 'predicted_mbti'), ('s', 'predicted_mbti'), ('ss', 'predicted_mbti')], schema)} AS predicted_mbti",
        f"{coalesce_expr([('f', 'archetype_code'), ('s', 'archetype_code'), ('ss', 'archetype_code')], schema)} AS archetype_code",
        f"{coalesce_expr([('f', 'character_code'), ('s', 'character_code'), ('ss', 'character_code')], schema)} AS character_code",
        f"{coalesce_expr([('s', 'created_at'), ('ss', 'created_at')], schema)} AS submission_time",
        f"{coalesce_expr([('s', 'app_version'), ('ss', 'app_version'), ('f', 'app_version')], schema)} AS submission_app_version",
        f"{coalesce_expr([('s', 'ei_score'), ('ss', 'ei_score')], schema)} AS ei_score",
        f"{coalesce_expr([('s', 'sn_score'), ('ss', 'sn_score')], schema)} AS sn_score",
        f"{coalesce_expr([('s', 'tf_score'), ('ss', 'tf_score')], schema)} AS tf_score",
        f"{coalesce_expr([('s', 'jp_score'), ('ss', 'jp_score')], schema)} AS jp_score",
        f"{coalesce_expr([('s', 'duration_ms'), ('ss', 'duration_ms')], schema)} AS duration_ms",
        f"{coalesce_expr([('s', 'questions_version')], schema)} AS questions_version",
    ]

    return f"""
    SELECT
      {", ".join(select)}
    FROM mbti_feedback f
    {" ".join(joins)}
    """


def parse_answers_json(value: Any) -> list[dict[str, Any]]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    try:
        parsed = json.loads(str(value))
    except json.JSONDecodeError:
        return []

    if isinstance(parsed, dict):
        return [
            {"question_id": str(question_id), "answer_value": answer_value}
            for question_id, answer_value in parsed.items()
        ]
    if isinstance(parsed, list):
        rows = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            question_id = item.get("questionId") or item.get("question_id") or item.get("id")
            answer_value = item.get("answerValue", item.get("answer_value"))
            if question_id is None or answer_value is None:
                continue
            rows.append({"question_id": str(question_id), "answer_value": answer_value})
        return rows
    return []


def export_feedback_answers(feedback: pd.DataFrame, out_dir: Path) -> None:
    rows: list[dict[str, Any]] = []
    for _, row in feedback.iterrows():
        for answer in parse_answers_json(row.get("answers_json")):
            rows.append({
                "feedback_id": row["feedback_id"],
                "submission_id": row.get("submission_id"),
                "self_mbti": row.get("self_mbti"),
                "confidence": row.get("confidence"),
                **answer,
            })

    pd.DataFrame(rows).to_csv(out_dir / "answers_from_feedback.csv", index=False, encoding="utf-8-sig")


def export_sampled_blob_answers(conn: sqlite3.Connection, out_dir: Path) -> None:
    if not table_exists(conn, "submission_answers_blob"):
        return
    blob = pd.read_sql_query("SELECT submission_id, answers_json FROM submission_answers_blob", conn)
    rows: list[dict[str, Any]] = []
    for _, row in blob.iterrows():
        for answer in parse_answers_json(row.get("answers_json")):
            rows.append({"submission_id": row["submission_id"], **answer})
    pd.DataFrame(rows).to_csv(out_dir / "answers_from_sampled_blob.csv", index=False, encoding="utf-8-sig")


def export_legacy_answers(conn: sqlite3.Connection, out_dir: Path) -> None:
    if not table_exists(conn, "submission_answers"):
        return
    answers = pd.read_sql_query(
        "SELECT submission_id, question_id, answer_value FROM submission_answers",
        conn,
    )
    answers.to_csv(out_dir / "answers_from_legacy_rows.csv", index=False, encoding="utf-8-sig")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build local SQLite and CSV exports from D1 SQL dump.")
    parser.add_argument("--sql", type=Path, help="Path to full D1 SQL export.")
    parser.add_argument("--db", type=Path, default=Path("analysis/acgti_feedback.db"))
    parser.add_argument("--reports-dir", type=Path, default=Path("analysis/reports"))
    parser.add_argument("--no-rebuild", action="store_true", help="Do not delete an existing local db before import.")
    args = parser.parse_args()

    if args.sql and not args.sql.exists():
        raise FileNotFoundError(args.sql)

    conn = load_sql_dump(args.sql, args.db, rebuild=not args.no_rebuild)
    if not table_exists(conn, "mbti_feedback"):
        raise RuntimeError("mbti_feedback table was not found in the local database.")

    args.reports_dir.mkdir(parents=True, exist_ok=True)

    feedback = pd.read_sql_query(build_feedback_query(conn), conn)
    feedback.to_csv(args.reports_dir / "feedback_joined.csv", index=False, encoding="utf-8-sig")
    export_feedback_answers(feedback, args.reports_dir)
    export_sampled_blob_answers(conn, args.reports_dir)
    export_legacy_answers(conn, args.reports_dir)

    print(f"sqlite: {args.db}")
    print(f"feedback rows: {len(feedback)}")
    print(f"reports: {args.reports_dir}")


if __name__ == "__main__":
    main()
