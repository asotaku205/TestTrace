// Adapter JS/TS đầy đủ qua Babel (nguồn: ADAPTER-JS-02).
// Hỗ trợ: sequence, if/else, switch, while/for/do-while/for-of/for-in,
// break/continue, early return, try/catch/finally.
// Defer: construct lạ → diagnostic unsupported có dòng/cột.
// Không regex, không thực thi mã.
import { parse } from '@babel/parser';
import type {
  DoWhileStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  IfStatement,
  Statement,
  SwitchStatement,
  TryStatement,
  WhileStatement,
} from '@babel/types';
import {
  createGraph,
  type CfgEdgeType,
  type CfgGraph,
  type LanguageAdapter,
  type SourceRange,
} from '@testtrace/cfg-core';

function fail(code: string, message: string, diagnostics: unknown[] = []): never {
  throw Object.assign(new Error(message), { code, diagnostics });
}

interface Loc {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

function toRange(node: { loc?: Loc | null }): SourceRange | undefined {
  if (!node.loc) return undefined;
  return {
    startLine: node.loc.start.line,
    startColumn: node.loc.start.column,
    endLine: node.loc.end.line,
    endColumn: node.loc.end.column,
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

function spanRange(statements: Array<{ loc?: Loc | null }>): SourceRange | undefined {
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

function unsupported(node: { type: string; loc?: Loc | null }): never {
  const range = toRange(node);
  fail('ADAPTER_UNSUPPORTED', `Cú pháp chưa hỗ trợ: ${node.type}`, [
    {
      line: range?.startLine ?? 1,
      column: range?.startColumn ?? 0,
      message: `Cú pháp chưa hỗ trợ: ${node.type}`,
      kind: 'unsupported',
    },
  ]);
}

function asBlock(statement: Statement): Statement[] {
  if (statement.type === 'BlockStatement') return statement.body;
  return [statement];
}

class Builder {
  private pending: Array<{ loc?: Loc | null }> = [];

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

  private goto(from: string, target: FlowTarget): void {
    this.graph.addEdge({ from, to: target.id, type: target.edge });
  }

  list(statements: Statement[], entry: string, exit: string): string | null {
    let prev: string | null = entry;
    for (const statement of statements) {
      if (prev === null) {
        this.pending.push({ loc: statement.loc });
        continue;
      }
      prev = this.statement(statement, prev, exit);
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

  statement(s: Statement, prev: string, exit: string): string | null {
    switch (s.type) {
      case 'ReturnStatement': {
        const anchor = this.flush(prev);
        const node = this.graph.addNode({ type: 'RETURN', sourceRange: toRange(s) });
        this.graph.addEdge({ from: anchor, to: node.id, type: 'NORMAL' });
        this.graph.addEdge({ from: node.id, to: this.ctx.funcExit, type: 'NORMAL' });
        return null;
      }
      case 'ThrowStatement': {
        const anchor = this.flush(prev);
        const node = this.graph.addNode({ type: 'THROW', sourceRange: toRange(s) });
        this.graph.addEdge({ from: anchor, to: node.id, type: 'NORMAL' });
        this.graph.addEdge({ from: node.id, to: this.ctx.funcExit, type: 'EXCEPTION' });
        return null;
      }
      case 'BreakStatement':
      case 'ContinueStatement': {
        const target = s.type === 'BreakStatement' ? this.ctx.breakTarget : this.ctx.continueTarget;
        if (!target) unsupported(s);
        const anchor = this.flush(prev);
        if (anchor !== (target as FlowTarget).id) {
          this.goto(anchor, target as FlowTarget);
        }
        return null;
      }
      case 'IfStatement':
        return this.ifStatement(s, prev, exit);
      case 'WhileStatement':
        return this.whileStatement(s, prev, exit);
      case 'ForStatement':
        return this.forStatement(s, prev, exit);
      case 'ForOfStatement':
      case 'ForInStatement':
        return this.forOfStatement(s, prev, exit);
      case 'DoWhileStatement':
        return this.doWhileStatement(s, prev, exit);
      case 'SwitchStatement':
        return this.switchStatement(s, prev, exit);
      case 'TryStatement':
        return this.tryStatement(s, prev, exit);
      case 'BlockStatement':
        return this.list(s.body, prev, exit) ?? prev;
      case 'EmptyStatement':
      case 'DebuggerStatement':
        return prev;
      case 'ExpressionStatement':
      case 'VariableDeclaration':
        this.pending.push({ loc: s.loc });
        return prev;
      default:
        unsupported(s);
    }
  }

  private ifStatement(s: IfStatement, prev: string, exit: string): string | null {
    void exit;
    const anchor = this.flush(prev);
    const dec = this.graph.addNode({ type: 'DECISION', label: 'if', sourceRange: toRange(s.test) });
    this.graph.addEdge({ from: anchor, to: dec.id, type: 'NORMAL' });
    const join = this.graph.addNode({ type: 'MERGE', label: 'after-if' });
    const sub = new Builder(this.graph, this.ctx);
    sub.listWithEntry(asBlock(s.consequent), dec.id, 'TRUE', join.id);
    if (s.alternate) {
      const alt = s.alternate.type === 'IfStatement' ? [s.alternate] : asBlock(s.alternate);
      sub.listWithEntry(alt, dec.id, 'FALSE', join.id);
    } else {
      this.graph.addEdge({ from: dec.id, to: join.id, type: 'FALSE' });
    }
    if (this.pruneIfOrphan(join.id)) return join.id;
    return s.alternate ? null : join.id;
  }

  private loopHead(
    label: string,
    test: { loc?: Loc | null },
    prev: string,
  ): { loop: string; after: string } {
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

  private whileStatement(s: WhileStatement, prev: string, exit: string): string {
    void exit;
    const { loop, after } = this.loopHead('while', s.test, prev);
    const bodyCtx: Ctx = {
      ...this.ctx,
      breakTarget: { id: after, edge: 'NORMAL' },
      continueTarget: { id: loop, edge: 'LOOP_BACK' },
    };
    const sub = new Builder(this.graph, bodyCtx);
    sub.listWithEntry(asBlock(s.body), loop, 'TRUE', loop);
    this.graph.addEdge({ from: loop, to: after, type: 'FALSE' });
    this.pruneIfOrphan(after);
    return after;
  }

  private forStatement(s: ForStatement, prev: string, exit: string): string {
    void exit;
    let anchor = this.flush(prev);
    if (s.init) {
      const init = this.graph.addNode({
        type: 'BASIC_BLOCK',
        label: 'for-init',
        sourceRange: toRange(s.init),
      });
      this.graph.addEdge({ from: anchor, to: init.id, type: 'NORMAL' });
      anchor = init.id;
    }
    const { loop, after } = this.loopHead('for', s.test ?? s, anchor);
    let updateId = loop;
    let continueEdge: CfgEdgeType = 'LOOP_BACK';
    if (s.update) {
      const update = this.graph.addNode({
        type: 'BASIC_BLOCK',
        label: 'for-update',
        sourceRange: toRange(s.update),
      });
      this.graph.addEdge({ from: update.id, to: loop, type: 'LOOP_BACK' });
      updateId = update.id;
      continueEdge = 'NORMAL';
    }
    const bodyCtx: Ctx = {
      ...this.ctx,
      breakTarget: { id: after, edge: 'NORMAL' },
      continueTarget: { id: updateId, edge: continueEdge },
    };
    const sub = new Builder(this.graph, bodyCtx);
    sub.listWithEntry(asBlock(s.body), loop, 'TRUE', updateId);
    this.graph.addEdge({ from: loop, to: after, type: 'FALSE' });
    this.pruneIfOrphan(after);
    return after;
  }

  private forOfStatement(s: ForOfStatement | ForInStatement, prev: string, exit: string): string {
    void exit;
    const { loop, after } = this.loopHead(
      s.type === 'ForOfStatement' ? 'for-of' : 'for-in',
      s,
      prev,
    );
    const bodyCtx: Ctx = {
      ...this.ctx,
      breakTarget: { id: after, edge: 'NORMAL' },
      continueTarget: { id: loop, edge: 'LOOP_BACK' },
    };
    const sub = new Builder(this.graph, bodyCtx);
    sub.listWithEntry(asBlock(s.body), loop, 'TRUE', loop);
    this.graph.addEdge({ from: loop, to: after, type: 'FALSE' });
    this.pruneIfOrphan(after);
    return after;
  }

  private tryStatement(s: TryStatement, prev: string, exit: string): string | null {
    void exit;
    const anchor = this.flush(prev);
    const tryEntry = this.graph.addNode({
      type: 'BASIC_BLOCK',
      label: 'try',
      sourceRange: toRange(s.block),
    });
    this.graph.addEdge({ from: anchor, to: tryEntry.id, type: 'NORMAL' });
    const after = this.graph.addNode({ type: 'MERGE', label: 'after-try' });
    const sub = new Builder(this.graph, this.ctx);
    sub.list(s.block.body, tryEntry.id, after.id);
    if (s.handler) {
      const catchEntry = this.graph.addNode({
        type: 'BASIC_BLOCK',
        label: 'catch',
        sourceRange: toRange(s.handler),
      });
      this.graph.addEdge({ from: tryEntry.id, to: catchEntry.id, type: 'EXCEPTION' });
      const handlerSub = new Builder(this.graph, this.ctx);
      handlerSub.list(s.handler.body.body, catchEntry.id, after.id);
    }
    if (s.finalizer) {
      // finally chỉ nối trên đường rơi qua: đường return/throw đi thẳng, không qua
      // finally (đơn giản hóa có chủ đích, tránh node mồ côi).
      const incoming = this.graph.edges.filter((e) => e.to === after.id);
      if (incoming.length > 0) {
        const finallyEntry = this.graph.addNode({
          type: 'BASIC_BLOCK',
          label: 'finally',
          sourceRange: toRange(s.finalizer),
        });
        for (const edge of incoming) edge.to = finallyEntry.id;
        const finSub = new Builder(this.graph, this.ctx);
        finSub.list(s.finalizer.body, finallyEntry.id, after.id);
      }
    }
    if (this.pruneIfOrphan(after.id)) return after.id;
    return null;
  }

  private doWhileStatement(s: DoWhileStatement, prev: string, exit: string): string {
    void exit;
    const anchor = this.flush(prev);
    const loop = this.graph.addNode({
      type: 'LOOP',
      label: 'do-while',
      sourceRange: toRange(s.test),
    });
    this.graph.addEdge({ from: anchor, to: loop.id, type: 'NORMAL' });
    const after = this.graph.addNode({ type: 'MERGE', label: 'after-loop' });
    const bodyCtx: Ctx = {
      ...this.ctx,
      breakTarget: { id: after.id, edge: 'NORMAL' },
      continueTarget: { id: loop.id, edge: 'LOOP_BACK' },
    };
    const sub = new Builder(this.graph, bodyCtx);
    sub.list(asBlock(s.body), loop.id, loop.id);
    this.graph.addEdge({ from: loop.id, to: after.id, type: 'FALSE' });
    this.pruneIfOrphan(after.id);
    return after.id;
  }

  private switchStatement(s: SwitchStatement, prev: string, exit: string): string | null {
    void exit;
    const anchor = this.flush(prev);
    const dec = this.graph.addNode({
      type: 'DECISION',
      label: 'switch',
      sourceRange: toRange(s.discriminant),
    });
    this.graph.addEdge({ from: anchor, to: dec.id, type: 'NORMAL' });
    const after = this.graph.addNode({ type: 'MERGE', label: 'after-switch' });
    const caseCtx: Ctx = {
      ...this.ctx,
      breakTarget: { id: after.id, edge: 'NORMAL' },
      continueTarget: this.ctx.continueTarget,
    };
    if (s.cases.length === 0) {
      this.graph.addEdge({ from: dec.id, to: after.id, type: 'NORMAL' });
    }
    for (const switchCase of s.cases) {
      if (
        switchCase.consequent.length === 1 &&
        switchCase.consequent[0].type === 'ReturnStatement'
      ) {
        const ret = switchCase.consequent[0];
        const retNode = this.graph.addNode({ type: 'RETURN', sourceRange: toRange(ret) });
        this.graph.addEdge({
          from: dec.id,
          to: retNode.id,
          type: switchCase.test ? 'CASE' : 'NORMAL',
        });
        this.graph.addEdge({ from: retNode.id, to: this.ctx.funcExit, type: 'NORMAL' });
        continue;
      }
      const caseEntry = this.graph.addNode({
        type: 'BASIC_BLOCK',
        label: switchCase.test ? 'case' : 'default',
        sourceRange: toRange(switchCase.test ?? switchCase),
      });
      this.graph.addEdge({
        from: dec.id,
        to: caseEntry.id,
        type: switchCase.test ? 'CASE' : 'NORMAL',
      });
      const sub = new Builder(this.graph, caseCtx);
      const end = sub.list(switchCase.consequent, caseEntry.id, after.id);
      if (end !== null && end !== after.id) {
        this.graph.addEdge({ from: end, to: after.id, type: 'NORMAL' });
      }
    }
    if (this.pruneIfOrphan(after.id)) return after.id;
    return null;
  }

  listWithEntry(statements: Statement[], entry: string, edgeType: CfgEdgeType, exit: string): void {
    const before = this.graph.edges.length;
    this.list(statements, entry, exit);
    const created = this.graph.edges.slice(before).find((e) => e.from === entry);
    if (created) {
      created.type = edgeType;
    } else {
      this.graph.addEdge({ from: entry, to: exit, type: edgeType });
    }
  }
}

export function buildControlFlow(source: string): CfgGraph {
  let program: { body: Statement[] };
  try {
    const file = parse(source, { plugins: ['typescript'], sourceType: 'module' });
    program = file.program;
  } catch (err) {
    const loc = (err as { loc?: { line: number; column: number } }).loc;
    fail('ADAPTER_SYNTAX', 'Cú pháp không hợp lệ', [
      {
        line: loc?.line ?? 1,
        column: loc?.column ?? 0,
        message: (err as Error).message,
        kind: 'syntax-error',
      },
    ]);
  }
  const fn = program.body.find((s) => s.type === 'FunctionDeclaration');
  if (!fn || fn.type !== 'FunctionDeclaration') {
    fail('ADAPTER_UNSUPPORTED', 'PoC chỉ xử lý FunctionDeclaration', [
      { line: 1, column: 0, message: 'Cần một FunctionDeclaration', kind: 'unsupported' },
    ]);
  }
  const graph = createGraph();
  const entry = graph.addNode({ type: 'ENTRY' });
  const exit = graph.addNode({ type: 'EXIT' });
  const ctx: Ctx = { funcExit: exit.id, breakTarget: null, continueTarget: null };
  const builder = new Builder(graph, ctx);
  builder.list(fn.body.body, entry.id, exit.id);
  return graph;
}

export function createJsTsAdapter(): LanguageAdapter {
  return {
    id: 'javascript-typescript',
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
