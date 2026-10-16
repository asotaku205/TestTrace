// PoC adapter JS/TS qua Babel: chỉ sequential + return (nguồn: ADAPTER-JS-01).
// Không regex, không hack walk AST: dùng trực tiếp File/FunctionDeclaration/Statement.
import { parse } from '@babel/parser';
import type { FunctionDeclaration, Statement } from '@babel/types';
import {
  createGraph,
  type CfgGraph,
  type LanguageAdapter,
  type SourceRange,
} from '@testtrace/cfg-core';

function toRange(node: {
  loc?: { start: { line: number; column: number }; end: { line: number; column: number } } | null;
}): SourceRange | undefined {
  if (!node.loc) return undefined;
  return {
    startLine: node.loc.start.line,
    startColumn: node.loc.start.column,
    endLine: node.loc.end.line,
    endColumn: node.loc.end.column,
  };
}

function firstFunction(source: string): FunctionDeclaration {
  const file = parse(source, { plugins: ['typescript'], sourceType: 'module' });
  for (const statement of file.program.body) {
    if (statement.type === 'FunctionDeclaration') return statement;
  }
  throw Object.assign(new Error('PoC chỉ xử lý đúng 1 FunctionDeclaration'), {
    code: 'POC_SINGLE_FUNCTION',
  });
}

function spanRange(statements: Statement[]): SourceRange | undefined {
  const first = statements[0];
  const last = statements[statements.length - 1];
  if (!first?.loc || !last?.loc) return undefined;
  return {
    startLine: first.loc.start.line,
    startColumn: first.loc.start.column,
    endLine: last.loc.end.line,
    endColumn: last.loc.end.column,
  };
}

export function buildSequential(source: string): CfgGraph {
  const fn = firstFunction(source);
  const graph = createGraph();
  const entry = graph.addNode({ type: 'ENTRY' });
  const body: Statement[] = fn.body.body;
  const returns = body.filter(
    (s: Statement): s is Statement & { type: 'ReturnStatement' } => s.type === 'ReturnStatement',
  );
  const rest = body.filter((s: Statement) => s.type !== 'ReturnStatement');
  let previous = entry.id;
  if (rest.length > 0) {
    const block = graph.addNode({
      type: 'BASIC_BLOCK',
      label: `${rest.length} statement(s)`,
      sourceRange: spanRange(rest),
    });
    graph.addEdge({ from: previous, to: block.id, type: 'NORMAL' });
    previous = block.id;
  }
  const exit = graph.addNode({ type: 'EXIT' });
  if (returns.length === 0) {
    graph.addEdge({ from: previous, to: exit.id, type: 'NORMAL' });
  }
  for (const ret of returns) {
    const retNode = graph.addNode({ type: 'RETURN', sourceRange: toRange(ret) });
    graph.addEdge({ from: previous, to: retNode.id, type: 'NORMAL' });
    graph.addEdge({ from: retNode.id, to: exit.id, type: 'NORMAL' });
  }
  return graph;
}

export function createJsTsAdapter(): LanguageAdapter {
  return {
    id: 'javascript-typescript',
    versions: ['poc'],
    buildControlFlow: (source: string) => buildSequential(source),
    locate: (graph, nodeId) => graph.nodes.find((n) => n.id === nodeId)?.sourceRange ?? null,
    capabilities: () => ({
      sequence: true,
      branch: false,
      loop: false,
      earlyReturn: false,
      exceptionFlow: false,
      asyncGenerator: false,
      preprocessor: false,
    }),
  };
}
