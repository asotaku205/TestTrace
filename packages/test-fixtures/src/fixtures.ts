// Corpus 4 fixture JS đầu tiên (nguồn: Q3 Slice 3).
// Oracle là lowering tham chiếu: ENTRY/EXIT riêng, RETURN là node riêng,
// LOOP vừa là điểm lặp vừa tính 1 decision.
export interface FixtureOracle {
  nodes: number;
  edges: number;
  decisions: number;
  complexity: number;
}

export interface CfgFixture {
  id: string;
  language: string;
  source: string;
  expected: FixtureOracle;
}

export const jsFixtures: CfgFixture[] = [
  {
    id: 'js-sequential',
    language: 'javascript',
    source: `function add(a, b) {
  const s = a + b;
  return s;
}`,
    expected: { nodes: 4, edges: 3, decisions: 0, complexity: 1 },
  },
  {
    id: 'js-branch',
    language: 'javascript',
    source: `function fee(total) {
  if (total > 100) {
    return 0;
  } else {
    return 5;
  }
}`,
    expected: { nodes: 5, edges: 5, decisions: 1, complexity: 2 },
  },
  {
    id: 'js-loop-break-continue',
    language: 'javascript',
    source: `function find(xs, target) {
  let i = 0;
  let found = -1;
  while (i < xs.length) {
    const x = xs[i];
    i = i + 1;
    if (x === target) {
      found = x;
      break;
    }
    continue;
  }
  return found;
}`,
    expected: { nodes: 10, edges: 11, decisions: 2, complexity: 3 },
  },
  {
    id: 'js-early-return',
    language: 'javascript',
    source: `function sign(n) {
  if (n > 0) {
    return 1;
  }
  if (n < 0) {
    return -1;
  }
  return 0;
}`,
    expected: { nodes: 9, edges: 10, decisions: 2, complexity: 3 },
  },
  {
    id: 'js-switch',
    language: 'javascript',
    source: `function label(n) {
  switch (n) {
    case 1:
      return 'one';
    case 2:
      return 'two';
    default:
      return 'other';
  }
}`,
    expected: { nodes: 6, edges: 7, decisions: 1, complexity: 3 },
  },
];
