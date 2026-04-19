from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split


VALID_MBTI = {
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
}


def parse_answers(value: Any) -> dict[str, float]:
    try:
        parsed = json.loads(str(value))
    except (TypeError, json.JSONDecodeError):
        return {}

    if isinstance(parsed, dict):
        return {f"q_{question_id}": float(answer) for question_id, answer in parsed.items()}

    if isinstance(parsed, list):
        result = {}
        for item in parsed:
            if not isinstance(item, dict):
                continue
            question_id = item.get("questionId") or item.get("question_id") or item.get("id")
            answer_value = item.get("answerValue", item.get("answer_value"))
            if question_id is None or answer_value is None:
                continue
            result[f"q_{question_id}"] = float(answer_value)
        return result

    return {}


def load_training_frame(conn: sqlite3.Connection, high_confidence: int) -> pd.DataFrame:
    df = pd.read_sql_query(
        """
        SELECT
          id,
          UPPER(TRIM(self_mbti)) AS self_mbti,
          confidence,
          answers_json
        FROM mbti_feedback
        WHERE answers_json IS NOT NULL
        """,
        conn,
    )
    df = df[df["self_mbti"].isin(VALID_MBTI)].copy()
    df = df[df["confidence"] >= high_confidence].copy()

    rows = []
    for _, row in df.iterrows():
        answers = parse_answers(row["answers_json"])
        if not answers:
            continue
        rows.append({"feedback_id": row["id"], "self_mbti": row["self_mbti"], **answers})

    return pd.DataFrame(rows).fillna(0)


def train_one_dimension(
    data: pd.DataFrame,
    feature_cols: list[str],
    dim: str,
    y: pd.Series,
    reports_dir: Path,
) -> dict[str, object]:
    positive = int(y.sum())
    negative = int(len(y) - positive)
    metric = {
        "dimension": dim,
        "n": len(y),
        "positive": positive,
        "negative": negative,
        "accuracy": None,
        "note": "",
    }

    if len(y) < 20 or y.nunique() < 2 or min(positive, negative) < 2:
        metric["note"] = "样本量或类别数不足，跳过训练"
        return metric

    stratify = y if min(positive, negative) >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        data[feature_cols],
        y,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )

    model = LogisticRegression(max_iter=2000, class_weight="balanced")
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    metric["accuracy"] = accuracy_score(y_test, pred)

    coef = pd.DataFrame({
        "feature": feature_cols,
        "coef": model.coef_[0],
        "abs_coef": abs(model.coef_[0]),
    }).sort_values("abs_coef", ascending=False)
    coef.to_csv(reports_dir / f"weights_{dim}.csv", index=False, encoding="utf-8-sig")
    return metric


def main() -> None:
    parser = argparse.ArgumentParser(description="Train simple dimension models from high-confidence feedback.")
    parser.add_argument("--db", type=Path, default=Path("analysis/acgti_feedback.db"))
    parser.add_argument("--reports-dir", type=Path, default=Path("analysis/reports"))
    parser.add_argument("--high-confidence", type=int, default=4)
    args = parser.parse_args()

    args.reports_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(args.db)
    data = load_training_frame(conn, args.high_confidence)
    if data.empty:
        raise RuntimeError("No usable high-confidence feedback answers found.")

    feature_cols = sorted([col for col in data.columns if col.startswith("q_")])
    targets = {
        "EI": data["self_mbti"].str[0].map({"E": 1, "I": 0}),
        "SN": data["self_mbti"].str[1].map({"S": 1, "N": 0}),
        "TF": data["self_mbti"].str[2].map({"T": 1, "F": 0}),
        "JP": data["self_mbti"].str[3].map({"J": 1, "P": 0}),
    }

    metrics = [
        train_one_dimension(data, feature_cols, dim, y, args.reports_dir)
        for dim, y in targets.items()
    ]
    metrics_df = pd.DataFrame(metrics)
    metrics_df.to_csv(args.reports_dir / "model_metrics.csv", index=False, encoding="utf-8-sig")

    print(metrics_df.to_string(index=False))
    print(f"reports: {args.reports_dir}")


if __name__ == "__main__":
    main()
