// Adapter Python qua stdlib ast: sequence/if/while/for (+else)/break/continue/return,
// try/except (+else/finally), match (nguồn: ADAPTER-PY-01).
// Defer: async → diagnostic unsupported.
// Không eval, không thực thi mã (bridge chỉ ast.parse).
import {
  createGraph,
  type CfgEdgeType,
  type CfgGraph,
  type LanguageAdapter,
  type SourceRange,
} from '@testtrace/cfg-core';
import { parsePythonSync, type PythonNode } from './bridge.js';

type Stmt = PythonNode & {
  _type: string;
  body?: Stmt[];
  orelse?: Stmt[];
  test?: Stmt;
};

function fail(code: string, message: string, diagnostics: unknown[] = []): never {
  throw Object.assign(new Error(message), { code, diagnostics });
}

function toRange(node: PythonNode): SourceRange | undefined {
  const startLine = node['@lineno'];
  const startColumn = node['@col_offset'];
  const endLine = node['@end_lineno'];
  const endColumn = node['@end_col_offset'];
  if (typeof startLine !== 'number' || typeof endLine !== 'number') return undefined;
  return {
    startLine,
    startColumn: typeof startColumn === 'number' ? startColumn : 0,
    endLine,
    endColumn: typeof endColumn === 'number' ? endColumn : 0,
  };
}

function unsupported(node: PythonNode, what: string): never {
  const range = toRange(node);
  fail('ADAPTER_UNSUPPORTED', `Cú pháp chưa hỗ trợ: ${what}`, [
    {
      line: range?.startLine ?? 1,
      column: range?.startColumn ?? 0,
      message: `Cú pháp chưa hỗ trợ: ${what}`,
      kind: 'unsupported',
    },
  ]);
}

function spanRange(statements: PythonNode[]): SourceRange | undefined {
  const first = statements[0];
  const last = statements[statements.length - 1];
  if (!first || !last) return undefined;
  const start = toRange(first);
  const end = toRange(last);
  if (!start || !end) return undefined;
  return {
    startLine: start.startLine,
    startColumn: start.startColumn,
    endLine: end.endLine,
    endColumn: end.endColumn,
  };
}

interface FlowTarget {
  id: string;
  edge: CfgEdgeType;
}

interface Ctx {
  funcExit: string;
  breakTarget: FlowTarget | null;
  continueTarget: FlowTarget | null;
}

const PLAIN = new Set([
  'Assign',
  'AnnAssign',
  'AugAssign',
  'Expr',
  'Import',
  'ImportFrom',
  'Pass',
  'Assert',
  'Delete',
  'Global',
  'Nonlocal',
]);

class Builder {
  private pending: PythonNode[] = [];

  constructor(
    private readonly graph: CfgGraph,
    private readonly ctx: Ctx,
  ) {}

  private flush(prev: string): string {
    if (this.pending.length === 0) return prev;
    const block = this.graph.addNode({
      type: 'BASIC_BLOCK',
      label: `${this.pending.length} statement(s)`,
      sourceRange: spanRange(this.pending),
    });
    this.graph.addEdge({ from: prev, to: block.id, type: 'NORMAL' });
    this.pending = [];
    return block.id;
  }

  list(statements: Stmt[], entry: string, exit: string): string | null {
    let prev: string | null = entry;
    for (const statement of statements) {
      if (prev === null) {
        this.pending.push(statement);
        continue;
      }
      prev = this.statement(statement, prev);
    }
    if (this.pending.length > 0) {
      const block = this.graph.addNode({
        type: 'BASIC_BLOCK',
        label: `${this.pending.length} statement(s)`,
        sourceRange: spanRange(this.pending),
      });
      this.pending = [];
      if (prev !== null) {
        this.graph.addEdge({ from: prev, to: block.id, type: 'NORMAL' });
        prev = block.id;
      }
    }
    if (prev !== null && prev !== exit) {
      this.graph.addEdge({ from: prev, to: exit, type: 'NORMAL' });
    }
    return prev;
  }

  listWithEntry(statements: Stmt[], entry: string, edgeType: CfgEdgeType, exit: string): void {
    const before = this.graph.edges.length;
    this.list(statements, entry, exit);
    const created = this.graph.edges.slice(before).find((e) => e.from === entry);
    if (created) {
      created.type = edgeType;
    } else {
      this.graph.addEdge({ from: entry, to: exit, type: edgeType });
    }
  }

  statement(s: Stmt, prev: string): string | null {
    if (PLAIN.has(s._type)) {
      this.pending.push(s);
      return prev;
    }
    switch (s._type) {
      case 'Return': {
        const anchor = this.flush(prev);
        const node = this.graph.addNode({ type: 'RETURN', sourceRange: toRange(s) });
        this.graph.addEdge({ from: anchor, to: node.id, type: 'NORMAL' });
        this.graph.addEdge({ from: node.id, to: this.ctx.funcExit, type: 'NORMAL' });
        return null;
      }
      case 'If':
        return this.ifStatement(s, prev);
      case 'While':
        return this.whileStatement(s, prev);
      case 'For':
        return this.forStatement(s, prev);
      case 'Break':
      case 'Continue': {
        const target = s._type === 'Break' ? this.ctx.breakTarget : this.ctx.continueTarget;
        if (!target) unsupported(s, s._type);
        const anchor = this.flush(prev);
        if (anchor !== (target as FlowTarget).id) {
          this.graph.addEdge({
            from: anchor,
            to: (target as FlowTarget).id,
            type: (target as FlowTarget).edge,
          });
        }
        return null;
      }
      case 'Try':
      case 'TryStar':
        return this.tryStatement(s, prev);
      case 'Match':
        return this.matchStatement(s, prev);
      case 'AsyncFunctionDef':
      case 'AsyncFor':
      case 'AsyncWith':
        unsupported(s, 'async');
        break;
      case 'With':
      case 'Delete':
        this.pending.push(s);
        return prev;
      default:
        unsupported(s, s._type);
    }
  }

  private ifStatement(s: Stmt, prev: string): string | null {
    const anchor = this.flush(prev);
    const dec = this.graph.addNode({
      type: 'DECISION',
      label: 'if',
      sourceRange: toRange((s.test as PythonNode) ?? s),
    });
    this.graph.addEdge({ from: anchor, to: dec.id, type: 'NORMAL' });
    const join = this.graph.addNode({ type: 'MERGE', label: 'after-if' });
    const sub = new Builder(this.graph, this.ctx);
    sub.listWithEntry((s.body as Stmt[]) ?? [], dec.id, 'TRUE', join.id);
    if (s.orelse && s.orelse.length > 0) {
      sub.listWithEntry(s.orelse, dec.id, 'FALSE', join.id);
    } else {
      this.graph.addEdge({ from: dec.id, to: join.id, type: 'FALSE' });
    }
    if (this.pruneIfOrphan(join.id)) return join.id;
    return s.orelse && s.orelse.length > 0 ? null : join.id;
  }

  private loopHead(label: string, test: PythonNode, prev: string): { loop: string; after: string } {
    const anchor = this.flush(prev);
    const loop = this.graph.addNode({ type: 'LOOP', label, sourceRange: toRange(test) });
    this.graph.addEdge({ from: anchor, to: loop.id, type: 'NORMAL' });
    const after = this.graph.addNode({ type: 'MERGE', label: 'after-loop' });
    return { loop: loop.id, after: after.id };
  }

  private pruneIfOrphan(id: string): boolean {
    const incoming = this.graph.edges.filter((e) => e.to === id);
    if (incoming.length === 0) {
      const index = this.graph.nodes.findIndex((n) => n.id === id);
      if (index >= 0) this.graph.nodes.splice(index, 1);
      return false;
    }
    return true;
  }

  private whileStatement(s: Stmt, prev: string): string {
    const orelse = (s.orelse as Stmt[]) ?? [];
    const { loop, after } = this.loopHead('while', (s.test as PythonNode) ?? s, prev);
    const bodyCtx: Ctx = {
      ...this.ctx,
      breakTarget: { id: after, edge: 'NORMAL' },
      continueTarget: { id: loop, edge: 'LOOP_BACK' },
    };
    const sub = new Builder(this.graph, bodyCtx);
    sub.listWithEntry((s.body as Stmt[]) ?? [], loop, 'TRUE', loop);
    if (orelse.length > 0) {
      // else chạy khi vòng lặp kết thúc tự nhiên; break nhảy thẳng tới after, bỏ qua else.
      const elseEntry = this.graph.addNode({
        type: 'BASIC_BLOCK',
        label: 'loop-else',
        sourceRange: spanRange(orelse),
      });
      this.graph.addEdge({ from: loop, to: elseEntry.id, type: 'FALSE' });
      const elseSub = new Builder(this.graph, this.ctx);
      elseSub.list(orelse, elseEntry.id, after);
    } else {
      this.graph.addEdge({ from: loop, to: after, type: 'FALSE' });
    }
    this.pruneIfOrphan(after);
    return after;
  }

  private forStatement(s: Stmt, prev: string): string {
    const orelse = (s.orelse as Stmt[]) ?? [];
    const anchor = this.flush(prev);
    const loop = this.graph.addNode({ type: 'LOOP', label: 'for', sourceRange: toRange(s) });
    this.graph.addEdge({ from: anchor, to: loop.id, type: 'NORMAL' });
    const after = this.graph.addNode({ type: 'MERGE', label: 'after-loop' });
    const bodyCtx: Ctx = {
      ...this.ctx,
      breakTarget: { id: after.id, edge: 'NORMAL' },
      continueTarget: { id: loop.id, edge: 'LOOP_BACK' },
    };
    const sub = new Builder(this.graph, bodyCtx);
    sub.listWithEntry((s.body as Stmt[]) ?? [], loop.id, 'TRUE', loop.id);
    if (orelse.length > 0) {
      const elseEntry = this.graph.addNode({
        type: 'BASIC_BLOCK',
        label: 'loop-else',
        sourceRange: spanRange(orelse),
      });
      this.graph.addEdge({ from: loop.id, to: elseEntry.id, type: 'FALSE' });
      const elseSub = new Builder(this.graph, this.ctx);
      elseSub.list(orelse, elseEntry.id, after.id);
    } else {
      this.graph.addEdge({ from: loop.id, to: after.id, type: 'FALSE' });
    }
    this.pruneIfOrphan(after.id);
    return after.id;
  }

  private tryStatement(s: Stmt, prev: string): string | null {
    const ext = s as unknown as {
      handlers?: Array<Stmt & { body?: Stmt[] }>;
      finalbody?: Stmt[];
    };
    const anchor = this.flush(prev);
    const tryEntry = this.graph.addNode({
      type: 'BASIC_BLOCK',
      label: 'try',
      sourceRange: spanRange((s.body as Stmt[]) ?? []),
    });
    this.graph.addEdge({ from: anchor, to: tryEntry.id, type: 'NORMAL' });
    const after = this.graph.addNode({ type: 'MERGE', label: 'after-try' });
    const sub = new Builder(this.graph, this.ctx);
    const mark = this.graph.edges.length;
    sub.list((s.body as Stmt[]) ?? [], tryEntry.id, after.id);
    // else chỉ chạy khi khối try rơi qua (không có exception): chặn đúng các cạnh rơi qua.
    const orelse = (s.orelse as Stmt[]) ?? [];
    if (orelse.length > 0) {
      const elseEntry = this.graph.addNode({
        type: 'BASIC_BLOCK',
        label: 'else',
        sourceRange: spanRange(orelse),
      });
      for (const edge of this.graph.edges.slice(mark)) {
        if (edge.to === after.id) edge.to = elseEntry.id;
      }
      const elseSub = new Builder(this.graph, this.ctx);
      elseSub.list(orelse, elseEntry.id, after.id);
    }
    for (const handler of ext.handlers ?? []) {
      const catchEntry = this.graph.addNode({
        type: 'BASIC_BLOCK',
        label: 'except',
        sourceRange: toRange(handler),
      });
      this.graph.addEdge({ from: tryEntry.id, to: catchEntry.id, type: 'EXCEPTION' });
      const handlerSub = new Builder(this.graph, this.ctx);
      handlerSub.list((handler.body as Stmt[]) ?? [], catchEntry.id, after.id);
    }
    const finalbody = ext.finalbody ?? [];
    if (finalbody.length > 0) {
      // finally chỉ nối trên đường rơi qua (đơn giản hóa có chủ đích, như adapter JS).
      const incoming = this.graph.edges.filter((e) => e.to === after.id);
      if (incoming.length > 0) {
        const finallyEntry = this.graph.addNode({
          type: 'BASIC_BLOCK',
          label: 'finally',
          sourceRange: spanRange(finalbody),
        });
        for (const edge of incoming) edge.to = finallyEntry.id;
        const finSub = new Builder(this.graph, this.ctx);
        finSub.list(finalbody, finallyEntry.id, after.id);
      }
    }
    if (this.pruneIfOrphan(after.id)) return after.id;
    return null;
  }

  private matchStatement(s: Stmt, prev: string): string | null {
    const ext = s as unknown as {
      subject?: PythonNode;
      cases?: Array<Stmt & { body?: Stmt[] }>;
    };
    const anchor = this.flush(prev);
    const dec = this.graph.addNode({
      type: 'DECISION',
      label: 'match',
      sourceRange: toRange(ext.subject ?? s),
    });
    this.graph.addEdge({ from: anchor, to: dec.id, type: 'NORMAL' });
    const after = this.graph.addNode({ type: 'MERGE', label: 'after-match' });
    const cases = ext.cases ?? [];
    if (cases.length === 0) {
      this.graph.addEdge({ from: dec.id, to: after.id, type: 'NORMAL' });
    }
    for (const matchCase of cases) {
      // Guard của case không mô hình hóa riêng: vẫn một cạnh CASE (đơn giản hóa có chủ đích).
      const caseEntry = this.graph.addNode({
        type: 'BASIC_BLOCK',
        label: 'case',
        sourceRange: toRange(matchCase),
      });
      this.graph.addEdge({ from: dec.id, to: caseEntry.id, type: 'CASE' });
      const sub = new Builder(this.graph, this.ctx);
      sub.list((matchCase.body as Stmt[]) ?? [], caseEntry.id, after.id);
    }
    if (this.pruneIfOrphan(after.id)) return after.id;
    return null;
  }
}

export function buildControlFlow(source: string): CfgGraph {
  let tree;
  try {
    tree = parsePythonSync(source);
  } catch (err) {
    const thrown = err as { code?: string; diagnostics?: unknown[]; message?: string };
    if (thrown.code === 'PY_SYNTAX') {
      fail('ADAPTER_SYNTAX', 'Cú pháp không hợp lệ', (thrown.diagnostics ?? []) as unknown[]);
    }
    throw err;
  }
  const fn = tree.body.find((n) => n._type === 'FunctionDef') as Stmt | undefined;
  if (!fn) {
    fail('ADAPTER_UNSUPPORTED', 'Cần một FunctionDef', [
      { line: 1, column: 0, message: 'Cần một FunctionDef', kind: 'unsupported' },
    ]);
  }
  const graph = createGraph();
  // ENTRY trỏ tới câu lệnh đầu tiên của thân hàm: code thật nơi thực thi bắt đầu.
  const bodyStmts = (fn.body as Stmt[]) ?? [];
  const entry = graph.addNode({
    type: 'ENTRY',
    sourceRange: bodyStmts[0] ? toRange(bodyStmts[0]) : undefined,
  });
  const exit = graph.addNode({ type: 'EXIT' });
  const builder = new Builder(graph, {
    funcExit: exit.id,
    breakTarget: null,
    continueTarget: null,
  });
  builder.list((fn.body as Stmt[]) ?? [], entry.id, exit.id);
  return graph;
}

export function createPythonAdapter(): LanguageAdapter {
  return {
    id: 'python',
    versions: ['0.1.0'],
    buildControlFlow: (source: string) => buildControlFlow(source),
    locate: (graph, nodeId) => graph.nodes.find((n) => n.id === nodeId)?.sourceRange ?? null,
    capabilities: () => ({
      sequence: true,
      branch: true,
      loop: true,
      earlyReturn: true,
      exceptionFlow: true,
      asyncGenerator: false,
      preprocessor: false,
    }),
  };
}
