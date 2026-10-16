// Corpus Python: cùng thuật toán mẫu, lowering tham chiếu giống JS (nguồn: CORPUS-PY-01).
// Oracle N/E/decision/complexity cho runner; negative cases cho adapter tests.
import type { CfgFixture } from './fixtures.js';

export interface NegativeFixture {
  id: string;
  language: string;
  source: string;
  kind: 'syntax-error' | 'unsupported';
}

export const pyFixtures: CfgFixture[] = [
  {
    id: 'py-sequential',
    language: 'python',
    source: `def add(a, b):
    s = a + b
    return s`,
    expected: { nodes: 4, edges: 3, decisions: 0, complexity: 1 },
  },
  {
    id: 'py-branch',
    language: 'python',
    source: `def fee(total):
    if total > 100:
        return 0
    else:
        return 5`,
    expected: { nodes: 5, edges: 5, decisions: 1, complexity: 2 },
  },
  {
    id: 'py-loop-break-continue',
    language: 'python',
    source: `def find(xs, target):
    i = 0
    found = -1
    while i < len(xs):
        x = xs[i]
        i = i + 1
        if x == target:
            found = x
            break
        continue
    return found`,
    expected: { nodes: 10, edges: 11, decisions: 2, complexity: 3 },
  },
  {
    id: 'py-early-return',
    language: 'python',
    source: `def sign(n):
    if n > 0:
        return 1
    if n < 0:
        return -1
    return 0`,
    expected: { nodes: 9, edges: 10, decisions: 2, complexity: 3 },
  },
];

export const pyNegativeFixtures: NegativeFixture[] = [
  {
    id: 'py-syntax-error',
    language: 'python',
    source: 'def broken(:\n',
    kind: 'syntax-error',
  },
  {
    id: 'py-try-except',
    language: 'python',
    source: `def f():
    try:
        return 1
    except Exception:
        return 2`,
    kind: 'unsupported',
  },
];
