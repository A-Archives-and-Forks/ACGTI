"""Quick version detail check for archetype and dimension analysis."""
from __future__ import annotations
import sqlite3, pandas as pd

conn = sqlite3.connect("analysis/acgti_feedback.db")

# Archetype distribution for 0.3.10
print("=== 0.3.10 Archetype distribution (conf>=4) ===")
arch = pd.read_sql_query("""
    SELECT archetype_code, COUNT(*) as n,
           ROUND(AVG(CASE WHEN self_mbti = predicted_mbti THEN 1 ELSE 0 END), 3) as match_rate
    FROM mbti_feedback
    WHERE app_version = '0.3.10-tf-q29-tu' AND confidence >= 4
      AND self_mbti IS NOT NULL AND predicted_mbti IS NOT NULL
      AND LENGTH(self_mbti) = 4
    GROUP BY archetype_code ORDER BY n DESC
""", conn)
for _, row in arch.iterrows():
    print(f'  {row["archetype_code"]:>25s}: n={row["n"]:3d}  match={row["match_rate"]:.1%}')

# JP direction analysis
print()
print("=== JP direction analysis (conf>=4) ===")
for ver in ["0.3.5-jp-fix", "0.3.9-tf-q13-res", "0.3.10-tf-q29-tu"]:
    d = pd.read_sql_query(f"""
        SELECT self_mbti, predicted_mbti FROM mbti_feedback
        WHERE app_version = '{ver}' AND confidence >= 4
          AND self_mbti IS NOT NULL AND predicted_mbti IS NOT NULL AND LENGTH(self_mbti) = 4
    """, conn)
    self_P = d[d["self_mbti"].str[3] == "P"]
    self_J = d[d["self_mbti"].str[3] == "J"]
    P_correct = (self_P["predicted_mbti"].str[3] == "P").sum()
    J_correct = (self_J["predicted_mbti"].str[3] == "J").sum()
    PtoJ = ((d["self_mbti"].str[3] == "P") & (d["predicted_mbti"].str[3] == "J")).sum()
    JtoP = ((d["self_mbti"].str[3] == "J") & (d["predicted_mbti"].str[3] == "P")).sum()
    jp_acc = (d["self_mbti"].str[3] == d["predicted_mbti"].str[3]).mean()
    pr = P_correct / len(self_P) if len(self_P) > 0 else 0
    jr = J_correct / len(self_J) if len(self_J) > 0 else 0
    print(f"  {ver:>22s}: JP={jp_acc:.1%} P_correct={pr:.1%}(n={len(self_P)}) J_correct={jr:.1%}(n={len(self_J)}) P->J={PtoJ} J->P={JtoP}")

# EI direction analysis
print()
print("=== EI direction analysis (conf>=4) ===")
for ver in ["0.3.5-jp-fix", "0.3.9-tf-q13-res", "0.3.10-tf-q29-tu"]:
    d = pd.read_sql_query(f"""
        SELECT self_mbti, predicted_mbti FROM mbti_feedback
        WHERE app_version = '{ver}' AND confidence >= 4
          AND self_mbti IS NOT NULL AND predicted_mbti IS NOT NULL AND LENGTH(self_mbti) = 4
    """, conn)
    self_I = d[d["self_mbti"].str[0] == "I"]
    self_E = d[d["self_mbti"].str[0] == "E"]
    I_correct = (self_I["predicted_mbti"].str[0] == "I").sum()
    E_correct = (self_E["predicted_mbti"].str[0] == "E").sum()
    ItoE = ((d["self_mbti"].str[0] == "I") & (d["predicted_mbti"].str[0] == "E")).sum()
    EtoI = ((d["self_mbti"].str[0] == "E") & (d["predicted_mbti"].str[0] == "I")).sum()
    ei_acc = (d["self_mbti"].str[0] == d["predicted_mbti"].str[0]).mean()
    ir = I_correct / len(self_I) if len(self_I) > 0 else 0
    er = E_correct / len(self_E) if len(self_E) > 0 else 0
    print(f"  {ver:>22s}: EI={ei_acc:.1%} I_correct={ir:.1%}(n={len(self_I)}) E_correct={er:.1%}(n={len(self_E)}) I->E={ItoE} E->I={EtoI}")

# SN direction analysis
print()
print("=== SN direction analysis (conf>=4) ===")
for ver in ["0.3.5-jp-fix", "0.3.9-tf-q13-res", "0.3.10-tf-q29-tu"]:
    d = pd.read_sql_query(f"""
        SELECT self_mbti, predicted_mbti FROM mbti_feedback
        WHERE app_version = '{ver}' AND confidence >= 4
          AND self_mbti IS NOT NULL AND predicted_mbti IS NOT NULL AND LENGTH(self_mbti) = 4
    """, conn)
    self_N = d[d["self_mbti"].str[1] == "N"]
    self_S = d[d["self_mbti"].str[1] == "S"]
    N_correct = (self_N["predicted_mbti"].str[1] == "N").sum()
    S_correct = (self_S["predicted_mbti"].str[1] == "S").sum()
    NtoS = ((d["self_mbti"].str[1] == "N") & (d["predicted_mbti"].str[1] == "S")).sum()
    StoN = ((d["self_mbti"].str[1] == "S") & (d["predicted_mbti"].str[1] == "N")).sum()
    sn_acc = (d["self_mbti"].str[1] == d["predicted_mbti"].str[1]).mean()
    nr = N_correct / len(self_N) if len(self_N) > 0 else 0
    sr = S_correct / len(self_S) if len(self_S) > 0 else 0
    print(f"  {ver:>22s}: SN={sn_acc:.1%} N_correct={nr:.1%}(n={len(self_N)}) S_correct={sr:.1%}(n={len(self_S)}) N->S={NtoS} S->N={StoN}")

conn.close()
