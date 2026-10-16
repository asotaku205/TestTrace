// PoC Babel: IR đúng cho 1 hàm mẫu + hỗ trợ TS (nguồn: ADAPTER-JS-01 guardrails).
import { describe, expect, it } from 'vitest';
import { assertFixture, jsFixtures } from '@testtrace/test-fixtures';
import { createJsTsAdapter } from './poc.js';

describe('babel poc', () => {
  it('fixture sequential ra IR đúng oracle', () => {
    const result = assertFixture(createJsTsAdapter(), jsFixtures[0]);
    expect(result).toEqual({ fixtureId: 'js-sequential', pass: true, failures: [] });
  });

  it('parse được type annotation TS và range map đúng dòng', () => {
    const adapter = createJsTsAdapter();
    const graph = adapter.buildControlFlow(`function add(a: number, b: number): number {
  const s: number = a + b;
  return s;
}`);
    const block = graph.nodes.find((n) => n.type === 'BASIC_BLOCK');
    expect(block?.sourceRange).toMatchObject({ startLine: 2, endLine: 2 });
    const ret = graph.nodes.find((n) => n.type === 'RETURN');
    expect(ret?.sourceRange).toMatchObject({ startLine: 3 });
  });
});
