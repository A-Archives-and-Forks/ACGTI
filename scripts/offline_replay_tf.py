"""Offline replay for TF weight tuning using latest feedback data."""
from __future__ import annotations
import sqlite3, json, pandas as pd
from collections import defaultdict
from copy import deepcopy

DB_PATH = "analysis/acgti_feedback.db"
WEIGHTS_PATH = "src/data/questionDimensionWeights.json"
QUESTIONS_PATH = "src/data/questions.json"

def load_data():
    conn = sqlite3.connect(DB_PATH)
    with open(WEIGHTS_PATH) as f:
        current_weights = json.load(f)
    with open(QUESTIONS_PATH, encoding="utf-8") as f:
        questions = json.load(f)
    q_info = {q["id"]: {"dimension": q["dimension"], "sign": q["sign"]} for q in questions}
    df = pd.read_sql_query("""
        SELECT self_mbti, predicted_mbti, confidence, answers_json, app_version
        FROM mbti_feedback
        WHERE confidence >= 4
          AND self_mbti IS NOT NULL
          AND answers_json IS NOT NULL
          AND LENGTH(self_mbti) = 4
    """, conn)
    conn.close()
    return df, current_weights, q_info

def compute_scores(answers_list, weights_override, q_info):
    rawScores = {"E_I": 0, "S_N": 0, "T_F": 0, "J_P": 0}
    directionalMax = {d: {"positive": 0, "negative": 0} for d in rawScores}
    for ans in answers_list:
        qid = ans.get("questionId", "")
        val = ans.get("answerValue", 0)
        if qid not in q_info or not (-3 <= val <= 3):
            continue
        info = q_info[qid]
        override = weights_override.get(qid, None)
        dw = override if override is not None else {info["dimension"]: info["sign"]}
        for dimension, weight in dw.items():
            if weight == 0:
                continue
            rawScores[dimension] += val * weight
            if weight > 0:
                directionalMax[dimension]["positive"] += 3 * weight
            else:
                directionalMax[dimension]["negative"] += 3 * abs(weight)
    scores = {}
    for dim in rawScores:
        raw = rawScores[dim]
        if raw >= 0:
            scores[dim] = raw / max(1, directionalMax[dim]["positive"])
        else:
            scores[dim] = raw / max(1, directionalMax[dim]["negative"])
    return scores

def predict_mbti(scores):
    mbti = ""
    mbti += "E" if scores.get("E_I", 0) >= 0 else "I"
    mbti += "S" if scores.get("S_N", 0) >= 0 else "N"
    mbti += "T" if scores.get("T_F", 0) >= 0 else "F"
    mbti += "J" if scores.get("J_P", 0) >= 0 else "P"
    return mbti

def evaluate(df, weights, q_info):
    r = {
        "EI": 0, "SN": 0, "TF": 0, "JP": 0, "full": 0, "tot": 0,
        "T_c": 0, "T_t": 0, "F_c": 0, "F_t": 0, "TtF": 0, "FtT": 0,
        "I_c": 0, "I_t": 0, "E_c": 0, "E_t": 0, "ItE": 0, "EtI": 0,
        "N_c": 0, "N_t": 0, "S_c": 0, "S_t": 0,
        "P_c": 0, "P_t": 0, "J_c": 0, "J_t": 0, "PtJ": 0, "JtP": 0,
    }
    for _, row in df.iterrows():
        try:
            answers = json.loads(row["answers_json"])
            if isinstance(answers, dict):
                answers = [{"questionId": k, "answerValue": v} for k, v in answers.items()]
        except Exception:
            continue
        scores = compute_scores(answers, weights, q_info)
        pred = predict_mbti(scores)
        s = row["self_mbti"]
        r["tot"] += 1
        if s[0] == pred[0]: r["EI"] += 1
        if s[1] == pred[1]: r["SN"] += 1
        if s[2] == pred[2]: r["TF"] += 1
        if s[3] == pred[3]: r["JP"] += 1
        if s == pred: r["full"] += 1
        # TF
        if s[2] == "T":
            r["T_t"] += 1
            if pred[2] == "T": r["T_c"] += 1
            if pred[2] == "F": r["TtF"] += 1
        else:
            r["F_t"] += 1
            if pred[2] == "F": r["F_c"] += 1
            if pred[2] == "T": r["FtT"] += 1
        # EI
        if s[0] == "I":
            r["I_t"] += 1
            if pred[0] == "I": r["I_c"] += 1
            else: r["ItE"] += 1
        else:
            r["E_t"] += 1
            if pred[0] == "E": r["E_c"] += 1
            else: r["EtI"] += 1
        # SN
        if s[1] == "N":
            r["N_t"] += 1
            if pred[1] == "N": r["N_c"] += 1
        else:
            r["S_t"] += 1
            if pred[1] == "S": r["S_c"] += 1
        # JP
        if s[3] == "P":
            r["P_t"] += 1
            if pred[3] == "P": r["P_c"] += 1
            else: r["PtJ"] += 1
        else:
            r["J_t"] += 1
            if pred[3] == "J": r["J_c"] += 1
            else: r["JtP"] += 1

    n = r["tot"]
    if n == 0:
        return None
    return {
        "n": n,
        "full": r["full"] / n,
        "EI": r["EI"] / n, "SN": r["SN"] / n, "TF": r["TF"] / n, "JP": r["JP"] / n,
        "T": r["T_c"] / r["T_t"] if r["T_t"] else 0,
        "F": r["F_c"] / r["F_t"] if r["F_t"] else 0,
        "TtF": r["TtF"], "FtT": r["FtT"],
        "I": r["I_c"] / r["I_t"] if r["I_t"] else 0,
        "E": r["E_c"] / r["E_t"] if r["E_t"] else 0,
        "ItE": r["ItE"], "EtI": r["EtI"],
        "N": r["N_c"] / r["N_t"] if r["N_t"] else 0,
        "S": r["S_c"] / r["S_t"] if r["S_t"] else 0,
        "P": r["P_c"] / r["P_t"] if r["P_t"] else 0,
        "J": r["J_c"] / r["J_t"] if r["J_t"] else 0,
        "PtJ": r["PtJ"], "JtP": r["JtP"],
    }


def main():
    df, current_weights, q_info = load_data()
    print(f"Total high-conf with answers: {len(df)}")

    # Current baseline
    cur = evaluate(df, current_weights, q_info)
    print(f"\n=== Current 0.3.9 weights ===")
    print(f"  n={cur['n']} full={cur['full']:.1%} EI={cur['EI']:.1%} SN={cur['SN']:.1%} TF={cur['TF']:.1%} JP={cur['JP']:.1%}")
    print(f"  T={cur['T']:.1%} F={cur['F']:.1%} TtF={cur['TtF']} FtT={cur['FtT']}")
    print(f"  I={cur['I']:.1%} E={cur['E']:.1%} ItE={cur['ItE']} EtI={cur['EtI']}")

    # === TF Grid Search ===
    print(f"\n=== TF Grid: q29 x q19 ===")
    print(f"{'q29':>5} {'q19':>5} | {'TF':>6} {'T':>6} {'F':>6} {'TtF':>4} {'FtT':>4} {'full':>6} {'EI':>6} {'JP':>6}")
    print("-" * 80)

    for q29_w in [1.0, 1.3, 1.5, 1.8, 2.0]:
        for q19_w in [0, 0.5, 1.0, 1.5]:
            w = deepcopy(current_weights)
            w["q29"] = {"T_F": q29_w}
            if q19_w == 0:
                w["q19"] = {"T_F": 0}
            elif q19_w != 1.0:
                w["q19"] = {"T_F": q19_w}
            else:
                w.pop("q19", None)
            r = evaluate(df, w, q_info)
            marker = " <--" if q29_w == 1.5 and q19_w == 1.0 else ""
            print(f"{q29_w:5.1f} {q19_w:5.1f} | {r['TF']:5.1%} {r['T']:5.1%} {r['F']:5.1%} {r['TtF']:4d} {r['FtT']:4d} {r['full']:5.1%} {r['EI']:5.1%} {r['JP']:5.1%}{marker}")
        print()

    # === TF Grid: q29 x q13 ===
    print(f"\n=== TF Grid: q29 x q13 ===")
    print(f"{'q29':>5} {'q13':>5} | {'TF':>6} {'T':>6} {'F':>6} {'TtF':>4} {'FtT':>4} {'full':>6}")
    print("-" * 70)

    for q29_w in [1.0, 1.3, 1.5, 1.8]:
        for q13_w in [0, 0.5, 1.0, 1.5]:
            w = deepcopy(current_weights)
            w["q29"] = {"T_F": q29_w}
            if q13_w == 0:
                w["q13"] = {"T_F": 0}
            elif q13_w != 1.0:
                w["q13"] = {"T_F": q13_w}
            else:
                w.pop("q13", None)
            r = evaluate(df, w, q_info)
            marker = " <--" if q29_w == 1.5 and q13_w == 1.0 else ""
            print(f"{q29_w:5.1f} {q13_w:5.1f} | {r['TF']:5.1%} {r['T']:5.1%} {r['F']:5.1%} {r['TtF']:4d} {r['FtT']:4d} {r['full']:5.1%}{marker}")
        print()

    # === Balanced optimization ===
    print(f"\n=== Balanced optimization: max composite(TF*0.5 + full*0.3 + balance*0.2), FtT<=1500, full>=0.24 ===")
    best_score = 0
    best_config = None
    for q29_w in [1.0, 1.2, 1.3, 1.5, 1.8, 2.0]:
        for q19_w in [0, 0.3, 0.5, 0.8, 1.0, 1.2, 1.5]:
            for q13_w in [0, 0.5, 1.0, 1.5]:
                w = deepcopy(current_weights)
                w["q29"] = {"T_F": q29_w}
                if q19_w == 0:
                    w["q19"] = {"T_F": 0}
                elif q19_w != 1.0:
                    w["q19"] = {"T_F": q19_w}
                else:
                    w.pop("q19", None)
                if q13_w == 0:
                    w["q13"] = {"T_F": 0}
                elif q13_w != 1.0:
                    w["q13"] = {"T_F": q13_w}
                else:
                    w.pop("q13", None)
                r = evaluate(df, w, q_info)
                if r["FtT"] <= 1500 and r["full"] >= 0.24:
                    balance = min(r["T"], r["F"])
                    composite = r["TF"] * 0.5 + r["full"] * 0.3 + balance * 0.2
                    if composite > best_score:
                        best_score = composite
                        best_config = (q29_w, q19_w, q13_w, r, deepcopy(w))

    if best_config:
        q29_w, q19_w, q13_w, r, w = best_config
        print(f"Best: q29={q29_w} q19={q19_w} q13={q13_w}")
        print(f"  TF={r['TF']:.1%} T={r['T']:.1%} F={r['F']:.1%} TtF={r['TtF']} FtT={r['FtT']}")
        print(f"  full={r['full']:.1%} EI={r['EI']:.1%} SN={r['SN']:.1%} JP={r['JP']:.1%}")
        print(f"  Delta vs current:")
        print(f"    TF: {r['TF']-cur['TF']:+.2%}  full: {r['full']-cur['full']:+.2%}  EI: {r['EI']-cur['EI']:+.2%}")
        print(f"    TtF: {r['TtF']-cur['TtF']:+d}  FtT: {r['FtT']-cur['FtT']:+d}")
    else:
        print("No config found meeting criteria (FtT<=1500, full>=0.24)")

    # === Also try: only change TF weights, keep everything else ===
    print(f"\n=== Targeted: only q29 adjustment ===")
    for q29_w in [1.0, 1.2, 1.3, 1.5, 1.8, 2.0, 2.5, 3.0]:
        w = deepcopy(current_weights)
        w["q29"] = {"T_F": q29_w}
        r = evaluate(df, w, q_info)
        dtf = r["TF"] - cur["TF"]
        dfull = r["full"] - cur["full"]
        print(f"  q29={q29_w:.1f}: TF={r['TF']:.1%}({dtf:+.1%}) T={r['T']:.1%} F={r['F']:.1%} TtF={r['TtF']} FtT={r['FtT']} full={r['full']:.1%}({dfull:+.1%})")


if __name__ == "__main__":
    main()
