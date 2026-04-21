"""
ACGTI 第 5 轮校准实验

基于 0.3.3-tf-fix 版本 feedback 数据的三维度联合微调。

问题诊断:
  E_I: 65.1%, 108 I->E (偏E)
  T_F: 65.1%, 92 T->F (偏F)
  J_P: 64.8%, 91 P->J (偏J)

策略:
  - E_I: q39 是最大噪声源(self=I 群体 w_avg=+1.00 向E), 需要禁用或反转
  - T_F: 9个F倾向题 vs 2个T倾向题, 结构失衡; T人群被压向F
  - J_P: q5,q8,q21 噪声大, self=P 人群在这些题上反而向J方向作答
"""
import json
import sqlite3
import sys
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'analysis', 'acgti_feedback.db')
QUESTIONS_PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'questions.json')
OVERRIDES_PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'questionDimensionWeights.json')

DIMENSION_LETTERS = {
    'E_I': ('E', 'I'),
    'S_N': ('S', 'N'),
    'T_F': ('T', 'F'),
    'J_P': ('J', 'P'),
}


def load_questions():
    with open(QUESTIONS_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_overrides():
    with open(OVERRIDES_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_feedback(min_confidence=4, version=None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    sql = ('SELECT self_mbti, confidence, answers_json, app_version '
           'FROM mbti_feedback WHERE answers_json IS NOT NULL AND predicted_mbti IS NOT NULL '
           'AND confidence >= ? ')
    params = [min_confidence]
    if version:
        sql += 'AND app_version = ? '
        params.append(version)
    sql += 'ORDER BY created_at'
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def replay_mbti(questions, dim_weights_map, answers_list):
    raw = {'E_I': 0.0, 'S_N': 0.0, 'T_F': 0.0, 'J_P': 0.0}
    dmax = {
        'E_I': {'pos': 0.0, 'neg': 0.0},
        'S_N': {'pos': 0.0, 'neg': 0.0},
        'T_F': {'pos': 0.0, 'neg': 0.0},
        'J_P': {'pos': 0.0, 'neg': 0.0},
    }

    for i, q in enumerate(questions):
        if i >= len(answers_list):
            break
        answer = answers_list[i]
        if not isinstance(answer, (int, float)) or answer < -3 or answer > 3:
            continue

        weights = dim_weights_map.get(q['id'], {q['dimension']: q['sign']})
        for dim, weight in weights.items():
            if weight == 0:
                continue
            raw[dim] += answer * weight
            if weight > 0:
                dmax[dim]['pos'] += 3 * weight
            else:
                dmax[dim]['neg'] += 3 * abs(weight)

    code = ''
    for dim in ('E_I', 'S_N', 'T_F', 'J_P'):
        r = raw[dim]
        if r >= 0:
            score = r / max(1, dmax[dim]['pos'])
        else:
            score = r / max(1, dmax[dim]['neg'])
        pos_letter, neg_letter = DIMENSION_LETTERS[dim]
        code += pos_letter if score >= 0 else neg_letter
    return code


def parse_answers(answers_raw, questions):
    try:
        answers_data = json.loads(answers_raw)
    except Exception:
        return None
    if isinstance(answers_data, list):
        answers_list = [0] * len(questions)
        for item in answers_data:
            qid = item.get('questionId', '')
            val = item.get('answerValue', 0)
            try:
                idx = int(qid.replace('q', '')) - 1
            except (ValueError, AttributeError):
                continue
            if 0 <= idx < len(answers_list):
                answers_list[idx] = val
        return answers_list
    return None


def build_dim_weights(questions, overrides, patch):
    """patch: dict of qid -> {dim: weight}, merged ON TOP of overrides"""
    result = {}
    for q in questions:
        qid = q['id']
        base = overrides.get(qid, {q['dimension']: q['sign']})
        if patch and qid in patch:
            merged = dict(base)
            merged.update(patch[qid])
            result[qid] = merged
        else:
            result[qid] = base
    return result


def run_batch(name, feedback_data, questions, overrides, patch, label=''):
    dwm = build_dim_weights(questions, overrides, patch)

    total = 0
    exact = 0
    dim_correct = {'E_I': 0, 'S_N': 0, 'T_F': 0, 'J_P': 0}
    dim_dir = {
        'E_I': {'I->E': 0, 'E->I': 0, 'I_total': 0, 'E_total': 0},
        'S_N': {'N->S': 0, 'S->N': 0, 'N_total': 0, 'S_total': 0},
        'T_F': {'T->F': 0, 'F->T': 0, 'T_total': 0, 'F_total': 0},
        'J_P': {'P->J': 0, 'J->P': 0, 'P_total': 0, 'J_total': 0},
    }

    for row in feedback_data:
        self_mbti = row['self_mbti']
        if not self_mbti or len(self_mbti) != 4:
            continue
        answers_list = parse_answers(row['answers_json'], questions)
        if answers_list is None:
            continue

        predicted = replay_mbti(questions, dwm, answers_list)
        total += 1
        if predicted == self_mbti:
            exact += 1

        for dim_idx, dim in enumerate(('E_I', 'S_N', 'T_F', 'J_P')):
            sl = self_mbti[dim_idx]
            pl = predicted[dim_idx]
            if sl == pl:
                dim_correct[dim] += 1
            dir_map = {
                'E_I': ('I', 'E', 'I->E'), 'S_N': ('N', 'S', 'N->S'),
                'T_F': ('T', 'F', 'T->F'), 'J_P': ('P', 'J', 'P->J'),
            }
            neg, pos, key = dir_map[dim]
            if sl == neg:
                dim_dir[dim][f'{neg}_total'] += 1
                if pl == pos:
                    dim_dir[dim][key] += 1
            else:
                dim_dir[dim][f'{pos}_total'] += 1
                rev_key = f'{pos}->{neg}'
                if pl == neg:
                    dim_dir[dim][rev_key] = dim_dir[dim].get(rev_key, 0) + 1

    if total == 0:
        return None

    r = {
        'match': exact * 100 / total,
        'EI': dim_correct['E_I'] * 100 / total,
        'SN': dim_correct['S_N'] * 100 / total,
        'TF': dim_correct['T_F'] * 100 / total,
        'JP': dim_correct['J_P'] * 100 / total,
    }
    ie = dim_dir['E_I']
    tf = dim_dir['T_F']
    jp = dim_dir['J_P']

    ie_rate = ie['I->E'] * 100 / max(1, ie['I_total'])
    tf_rate = tf['T->F'] * 100 / max(1, tf['T_total'])
    jp_rate = jp['P->J'] * 100 / max(1, jp['P_total'])

    print(f"  [{name:35s}] match={r['match']:5.1f}% "
          f"EI={r['EI']:5.1f}% SN={r['SN']:5.1f}% TF={r['TF']:5.1f}% JP={r['JP']:5.1f}% | "
          f"I->E={ie_rate:4.1f}% T->F={tf_rate:4.1f}% P->J={jp_rate:4.1f}% | {label}")

    return r


def main():
    min_conf = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    version_filter = sys.argv[2] if len(sys.argv) > 2 else None
    questions = load_questions()
    overrides = load_overrides()

    # Use latest version data for calibration
    feedback_latest = load_feedback(min_conf, '0.3.3-tf-fix')
    # Also test on all data for stability
    feedback_all = load_feedback(min_conf)

    print(f"Round 5: Three-dimension joint calibration")
    print(f"  Latest version data: n={len(feedback_latest)}")
    print(f"  All data: n={len(feedback_all)}")
    print()

    # ===== BASELINE =====
    print("=== BASELINE ===")
    print("-- on latest version data --")
    run_batch('baseline (no overrides)', feedback_latest, questions, {}, None, '0.3.0 baseline')
    run_batch('current production', feedback_latest, questions, overrides, None, '0.3.3 current')
    print()

    # ===== E_I FIX: q39 noise =====
    print("=== E_I: fix q39 noise ===")
    print("-- on latest version data --")
    run_batch('EI-q39:0', feedback_latest, questions, overrides,
              {'q39': {'E_I': 0}}, 'disable q39 for E_I')
    run_batch('EI-q39:-0.5', feedback_latest, questions, overrides,
              {'q39': {'E_I': -0.5}}, 'reverse q39 lightly')
    run_batch('EI-q39:-1', feedback_latest, questions, overrides,
              {'q39': {'E_I': -1}}, 'reverse q39')
    run_batch('EI-q11:-1.5', feedback_latest, questions, overrides,
              {'q11': {'E_I': -1.5}}, 'amplify q11 I-push')
    run_batch('EI-q39:0+q11:-1.5', feedback_latest, questions, overrides,
              {'q39': {'E_I': 0}, 'q11': {'E_I': -1.5}}, 'q39 off + q11 amplified')
    run_batch('EI-q39:-0.5+q11:-1.5', feedback_latest, questions, overrides,
              {'q39': {'E_I': -0.5}, 'q11': {'E_I': -1.5}}, 'q39 light reverse + q11 amplified')
    print()

    # ===== T_F FIX: structural imbalance =====
    print("=== T_F: fix structural imbalance (9 F-lean vs 2 T-lean) ===")
    print("-- on latest version data --")
    # Reduce the noisiest F-leaning questions
    for qid in ['q1', 'q9', 'q18', 'q22', 'q19', 'q27']:
        run_batch(f'TF-{qid}:0', feedback_latest, questions, overrides,
                  {qid: {'T_F': 0}}, f'disable {qid} for T_F')
    print()
    # Amplify T-leaning questions
    run_batch('TF-q7:2', feedback_latest, questions, overrides,
              {'q7': {'T_F': 2}}, 'amplify q7 T-push')
    run_batch('TF-q29:2', feedback_latest, questions, overrides,
              {'q29': {'T_F': 2}}, 'amplify q29 T-push (already 1.5)')
    print()
    # Combined: reduce noise + amplify T
    run_batch('TF-q1:0+q9:0+q7:2', feedback_latest, questions, overrides,
              {'q1': {'T_F': 0}, 'q9': {'T_F': 0}, 'q7': {'T_F': 2}},
              'drop q1,q9 + amplify q7')
    run_batch('TF-q1:0+q18:0+q7:2', feedback_latest, questions, overrides,
              {'q1': {'T_F': 0}, 'q18': {'T_F': 0}, 'q7': {'T_F': 2}},
              'drop q1,q18 + amplify q7')
    run_batch('TF-q1:0+q22:0+q7:2', feedback_latest, questions, overrides,
              {'q1': {'T_F': 0}, 'q22': {'T_F': 0}, 'q7': {'T_F': 2}},
              'drop q1,q22 + amplify q7')
    # Try reducing all the worst F-biased questions
    run_batch('TF-reduce-F-bunch', feedback_latest, questions, overrides,
              {'q1': {'T_F': 0}, 'q9': {'T_F': 0}, 'q18': {'T_F': 0}, 'q22': {'T_F': 0},
               'q7': {'T_F': 2}},
              'drop q1,q9,q18,q22 + amplify q7')
    run_batch('TF-reduce-F-bunch-v2', feedback_latest, questions, overrides,
              {'q1': {'T_F': 0}, 'q9': {'T_F': 0}, 'q18': {'T_F': 0}, 'q22': {'T_F': 0},
               'q7': {'T_F': 2}, 'q29': {'T_F': 2}},
              'drop q1,q9,q18,q22 + amplify q7,q29')
    print()

    # ===== J_P FIX: noise in P-leaning questions =====
    print("=== J_P: fix P->J bias ===")
    print("-- on latest version data --")
    # q5, q8, q21 are the worst: self=P answers toward J direction
    for qid in ['q5', 'q8', 'q21', 'q33', 'q34', 'q37', 'q38']:
        run_batch(f'JP-{qid}:0', feedback_latest, questions, overrides,
                  {qid: {'J_P': 0}}, f'disable {qid} for J_P')
    print()
    # Combined removal of noisy P-lean questions
    run_batch('JP-no-q5+q8', feedback_latest, questions, overrides,
              {'q5': {'J_P': 0}, 'q8': {'J_P': 0}}, 'drop q5,q8')
    run_batch('JP-no-q5+q21', feedback_latest, questions, overrides,
              {'q5': {'J_P': 0}, 'q21': {'J_P': 0}}, 'drop q5,q21')
    run_batch('JP-no-q8+q21', feedback_latest, questions, overrides,
              {'q8': {'J_P': 0}, 'q21': {'J_P': 0}}, 'drop q8,q21')
    run_batch('JP-no-q5+q8+q21', feedback_latest, questions, overrides,
              {'q5': {'J_P': 0}, 'q8': {'J_P': 0}, 'q21': {'J_P': 0}}, 'drop q5,q8,q21')
    print()

    # ===== COMBINED: best from each dimension =====
    print("=== COMBINED: best candidates ===")
    print("-- on latest version data --")

    # Candidate 1: conservative
    run_batch('COMBO-conservative', feedback_latest, questions, overrides,
              {'q39': {'E_I': 0},
               'q1': {'T_F': 0}, 'q7': {'T_F': 2},
               'q5': {'J_P': 0}, 'q8': {'J_P': 0}},
              'EI:q39 off; TF:q1 off+q7 x2; JP:q5+q8 off')

    # Candidate 2: moderate
    run_batch('COMBO-moderate', feedback_latest, questions, overrides,
              {'q39': {'E_I': 0}, 'q11': {'E_I': -1.5},
               'q1': {'T_F': 0}, 'q9': {'T_F': 0}, 'q7': {'T_F': 2},
               'q5': {'J_P': 0}, 'q8': {'J_P': 0}, 'q21': {'J_P': 0}},
              'EI:q39 off+q11 x1.5; TF:q1+q9 off+q7 x2; JP:q5+q8+q21 off')

    # Candidate 3: aggressive
    run_batch('COMBO-aggressive', feedback_latest, questions, overrides,
              {'q39': {'E_I': -0.5}, 'q11': {'E_I': -1.5},
               'q1': {'T_F': 0}, 'q9': {'T_F': 0}, 'q18': {'T_F': 0}, 'q22': {'T_F': 0},
               'q7': {'T_F': 2}, 'q29': {'T_F': 2},
               'q5': {'J_P': 0}, 'q8': {'J_P': 0}, 'q21': {'J_P': 0}},
              'EI:q39 rev+q11 x1.5; TF:4off+2xamp; JP:3off')

    print()

    # ===== Validate best candidates on ALL data =====
    print("=== VALIDATE on ALL data ===")
    print("-- on all version data --")
    run_batch('baseline (no overrides)', feedback_all, questions, {}, None, '0.3.0 baseline')
    run_batch('current production', feedback_all, questions, overrides, None, '0.3.3 current')
    run_batch('COMBO-conservative', feedback_all, questions, overrides,
              {'q39': {'E_I': 0},
               'q1': {'T_F': 0}, 'q7': {'T_F': 2},
               'q5': {'J_P': 0}, 'q8': {'J_P': 0}},
              'EI:q39 off; TF:q1 off+q7 x2; JP:q5+q8 off')
    run_batch('COMBO-moderate', feedback_all, questions, overrides,
              {'q39': {'E_I': 0}, 'q11': {'E_I': -1.5},
               'q1': {'T_F': 0}, 'q9': {'T_F': 0}, 'q7': {'T_F': 2},
               'q5': {'J_P': 0}, 'q8': {'J_P': 0}, 'q21': {'J_P': 0}},
              'EI:q39 off+q11 x1.5; TF:q1+q9 off+q7 x2; JP:q5+q8+q21 off')
    run_batch('COMBO-aggressive', feedback_all, questions, overrides,
              {'q39': {'E_I': -0.5}, 'q11': {'E_I': -1.5},
               'q1': {'T_F': 0}, 'q9': {'T_F': 0}, 'q18': {'T_F': 0}, 'q22': {'T_F': 0},
               'q7': {'T_F': 2}, 'q29': {'T_F': 2},
               'q5': {'J_P': 0}, 'q8': {'J_P': 0}, 'q21': {'J_P': 0}},
              'EI:q39 rev+q11 x1.5; TF:4off+2xamp; JP:3off')

    print("\nDone.")


if __name__ == '__main__':
    main()
