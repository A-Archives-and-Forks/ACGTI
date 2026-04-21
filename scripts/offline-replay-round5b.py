"""
ACGTI Round 5b: Refined calibration based on Round 5 findings
"""
import json, sqlite3, os, sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'analysis', 'acgti_feedback.db')
QUESTIONS_PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'questions.json')
OVERRIDES_PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'questionDimensionWeights.json')
DIMENSION_LETTERS = {'E_I': ('E','I'), 'S_N': ('S','N'), 'T_F': ('T','F'), 'J_P': ('J','P')}

with open(QUESTIONS_PATH, 'r', encoding='utf-8') as f:
    questions = json.load(f)
with open(OVERRIDES_PATH, 'r', encoding='utf-8') as f:
    overrides = json.load(f)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
rows = conn.execute('''
    SELECT self_mbti, answers_json FROM mbti_feedback
    WHERE confidence >= 4 AND predicted_mbti IS NOT NULL
      AND answer_count = 39 AND app_version = '0.3.3-tf-fix'
''').fetchall()
conn.close()
feedback = [dict(r) for r in rows]
print('n=%d (latest version only)' % len(feedback))

# Also load all data for validation
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
rows_all = conn.execute('''
    SELECT self_mbti, answers_json FROM mbti_feedback
    WHERE confidence >= 4 AND predicted_mbti IS NOT NULL
      AND answer_count = 39
''').fetchall()
conn.close()
feedback_all = [dict(r) for r in rows_all]
print('n=%d (all versions)' % len(feedback_all))


def parse_answers(raw, qs):
    d = json.loads(raw)
    a = [0] * len(qs)
    for item in d:
        idx = int(item['questionId'].replace('q', '')) - 1
        if 0 <= idx < len(a):
            a[idx] = item['answerValue']
    return a


def replay(qs, dwm, ans):
    raw = {'E_I': 0, 'S_N': 0, 'T_F': 0, 'J_P': 0}
    dmax = {d: {'pos': 0, 'neg': 0} for d in raw}
    for i, q in enumerate(qs):
        if i >= len(ans):
            break
        a = ans[i]
        if not isinstance(a, (int, float)) or a < -3 or a > 3:
            continue
        ws = dwm.get(q['id'], {q['dimension']: q['sign']})
        for dim, w in ws.items():
            if w == 0:
                continue
            raw[dim] += a * w
            if w > 0:
                dmax[dim]['pos'] += 3 * w
            else:
                dmax[dim]['neg'] += 3 * abs(w)
    code = ''
    for dim in ('E_I', 'S_N', 'T_F', 'J_P'):
        r = raw[dim]
        s = r / max(1, dmax[dim]['pos']) if r >= 0 else r / max(1, dmax[dim]['neg'])
        code += DIMENSION_LETTERS[dim][0] if s >= 0 else DIMENSION_LETTERS[dim][1]
    return code


def build_dw(qs, ov, patch):
    r = {}
    for q in qs:
        qid = q['id']
        base = ov.get(qid, {q['dimension']: q['sign']})
        if patch and qid in patch:
            m = dict(base)
            m.update(patch[qid])
            r[qid] = m
        else:
            r[qid] = base
    return r


def run(name, fb, qs, ov, patch, label=''):
    dwm = build_dw(qs, ov, patch)
    total = exact = 0
    dc = {'E_I': 0, 'S_N': 0, 'T_F': 0, 'J_P': 0}
    dirs = {'I->E': 0, 'T->F': 0, 'P->J': 0}
    it = tt = pt = 0
    for row in fb:
        mbti = row['self_mbti']
        if not mbti or len(mbti) != 4:
            continue
        ans = parse_answers(row['answers_json'], qs)
        pred = replay(qs, dwm, ans)
        total += 1
        if pred == mbti:
            exact += 1
        for di, dim in enumerate(('E_I', 'S_N', 'T_F', 'J_P')):
            s, p = mbti[di], pred[di]
            if s == p:
                dc[dim] += 1
            if dim == 'E_I' and s == 'I':
                it += 1
                if p == 'E':
                    dirs['I->E'] += 1
            if dim == 'T_F' and s == 'T':
                tt += 1
                if p == 'F':
                    dirs['T->F'] += 1
            if dim == 'J_P' and s == 'P':
                pt += 1
                if p == 'J':
                    dirs['P->J'] += 1
    if total == 0:
        return
    r = {
        'm': exact * 100 / total,
        'EI': dc['E_I'] * 100 / total,
        'SN': dc['S_N'] * 100 / total,
        'TF': dc['T_F'] * 100 / total,
        'JP': dc['J_P'] * 100 / total,
    }
    ie_r = dirs['I->E'] * 100 / max(1, it)
    tf_r = dirs['T->F'] * 100 / max(1, tt)
    jp_r = dirs['P->J'] * 100 / max(1, pt)
    print('  [%-30s] m=%5.1f EI=%5.1f SN=%5.1f TF=%5.1f JP=%5.1f | I>=%4.1f T>F=%4.1f P>J=%4.1f | %s' % (
        name, r['m'], r['EI'], r['SN'], r['TF'], r['JP'], ie_r, tf_r, jp_r, label))
    return r


print('\n=== REFINED T_F experiments ===')
for q_off in ['q19', 'q27', 'q19+q27']:
    patch = {}
    for q in q_off.split('+'):
        patch[q] = {'T_F': 0}
    run('TF-off-%s' % q_off, feedback, questions, overrides, patch, 'drop %s' % q_off)

for q7w in [1.5, 2.0]:
    run('TF-q19:0+q7:%g' % q7w, feedback, questions, overrides,
        {'q19': {'T_F': 0}, 'q7': {'T_F': q7w}}, 'q19 off + q7 x%g' % q7w)
    run('TF-q27:0+q7:%g' % q7w, feedback, questions, overrides,
        {'q27': {'T_F': 0}, 'q7': {'T_F': q7w}}, 'q27 off + q7 x%g' % q7w)

run('TF-q19+q27:0+q7:2', feedback, questions, overrides,
    {'q19': {'T_F': 0}, 'q27': {'T_F': 0}, 'q7': {'T_F': 2}}, 'q19+q27 off + q7 x2')

for qid in ['q19', 'q27']:
    for w in [-0.3, -0.5]:
        run('TF-%s:%g' % (qid, w), feedback, questions, overrides,
            {qid: {'T_F': w}}, '%s T_F:%g (reduced)' % (qid, w))

print('\n=== REFINED J_P experiments ===')
run('JP-q34:0', feedback, questions, overrides, {'q34': {'J_P': 0}}, 'q34 off')
run('JP-q34:0+q33:0', feedback, questions, overrides,
    {'q34': {'J_P': 0}, 'q33': {'J_P': 0}}, 'q34+q33 off')
for w in [0.3, 0.5]:
    run('JP-q34:%g' % w, feedback, questions, overrides,
        {'q34': {'J_P': w}}, 'q34 J_P:%g' % w)
for q21w in [-1.5, -2.0]:
    run('JP-q34:0+q21:%g' % q21w, feedback, questions, overrides,
        {'q34': {'J_P': 0}, 'q21': {'J_P': q21w}}, 'q34 off + q21 x%g' % q21w)

print('\n=== BEST COMBOS (latest data) ===')
run('current', feedback, questions, overrides, None, '0.3.3 current')
run('BEST-v1', feedback, questions, overrides,
    {'q39': {'E_I': 0}, 'q34': {'J_P': 0}},
    'EI:q39 off + JP:q34 off')
run('BEST-v2', feedback, questions, overrides,
    {'q39': {'E_I': 0}, 'q19': {'T_F': 0}, 'q34': {'J_P': 0}},
    'EI:q39 off + TF:q19 off + JP:q34 off')
run('BEST-v3', feedback, questions, overrides,
    {'q39': {'E_I': 0}, 'q27': {'T_F': 0}, 'q34': {'J_P': 0}},
    'EI:q39 off + TF:q27 off + JP:q34 off')
run('BEST-v4', feedback, questions, overrides,
    {'q39': {'E_I': 0}, 'q19': {'T_F': 0}, 'q27': {'T_F': 0}, 'q34': {'J_P': 0}},
    'EI:q39 off + TF:q19+q27 off + JP:q34 off')
run('BEST-v5', feedback, questions, overrides,
    {'q39': {'E_I': 0}, 'q19': {'T_F': -0.5}, 'q34': {'J_P': 0}},
    'EI:q39 off + TF:q19 reduced + JP:q34 off')
run('BEST-v6', feedback, questions, overrides,
    {'q39': {'E_I': 0}, 'q19': {'T_F': -0.5}, 'q27': {'T_F': -0.5}, 'q34': {'J_P': 0}},
    'EI:q39 off + TF:q19+q27 reduced + JP:q34 off')

# Additional combos with TF amplify
run('BEST-v7', feedback, questions, overrides,
    {'q39': {'E_I': 0}, 'q19': {'T_F': 0}, 'q7': {'T_F': 2}, 'q34': {'J_P': 0}},
    'EI:q39 off + TF:q19 off+q7 x2 + JP:q34 off')
run('BEST-v8', feedback, questions, overrides,
    {'q39': {'E_I': 0}, 'q19': {'T_F': -0.5}, 'q7': {'T_F': 1.5}, 'q34': {'J_P': 0}},
    'EI:q39 off + TF:q19 reduced+q7 x1.5 + JP:q34 off')
run('BEST-v9', feedback, questions, overrides,
    {'q39': {'E_I': 0}, 'q27': {'T_F': -0.5}, 'q34': {'J_P': 0}},
    'EI:q39 off + TF:q27 reduced + JP:q34 off')

print('\n=== VALIDATE best on ALL data ===')
run('current', feedback_all, questions, overrides, None, '0.3.3 current (all data)')

# Test top 3 candidates on all data
best_patches = {
    'BEST-v1': {'q39': {'E_I': 0}, 'q34': {'J_P': 0}},
    'BEST-v2': {'q39': {'E_I': 0}, 'q19': {'T_F': 0}, 'q34': {'J_P': 0}},
    'BEST-v3': {'q39': {'E_I': 0}, 'q27': {'T_F': 0}, 'q34': {'J_P': 0}},
    'BEST-v5': {'q39': {'E_I': 0}, 'q19': {'T_F': -0.5}, 'q34': {'J_P': 0}},
    'BEST-v6': {'q39': {'E_I': 0}, 'q19': {'T_F': -0.5}, 'q27': {'T_F': -0.5}, 'q34': {'J_P': 0}},
    'BEST-v7': {'q39': {'E_I': 0}, 'q19': {'T_F': 0}, 'q7': {'T_F': 2}, 'q34': {'J_P': 0}},
}
for name, patch in best_patches.items():
    run(name, feedback_all, questions, overrides, patch, '')

print('\nDone.')
