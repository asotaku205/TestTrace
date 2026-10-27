// Chạy thử function JS/TS để gợi ý oracle cho draft (nguồn: GEN-ORACLE-01).
// Chỉ chạy code do chính user dán vào (họ tự chạy code của mình), trong context
// vm mới: không require/process/console, cấm eval/Function (codeGeneration),
// che `constructor` trên global để chặn chuỗi thoát this.constructor.constructor,
// timeout 500ms. Mọi lỗi parse/timeout/dùng tên ngoài sandbox -> unsupported.
// CẢNH BÁO TRUNG THỰC: node:vm KHÔNG phải sandbox bảo mật tuyệt đối, chỉ là
// lớp giảm rủi ro cho đồ án tự host; không dùng để chạy code không tin cậy
// trên máy chủ chung. Adapter vẫn không thực thi mã; chạy thử chỉ xảy ra
// ở đây, khi sinh draft.
import { parse } from '@babel/parser';
import vm from 'node:vm';

export type TrialOutcome =
  | { outcome: 'returned'; value: unknown }
  | { outcome: 'threw'; name: string; message: string }
  | { outcome: 'unsupported'; reason: string };

const MAX_SOURCE = 10_000;

interface FnShape {
  name: string;
  params: string[];
}

function fnShape(source: string): FnShape | null {
  let program: { body: Array<{ type: string }> };
  try {
    program = parse(source, { plugins: ['typescript'], sourceType: 'module' }).program;
  } catch {
    return null;
  }
  const fn = program.body.find((s) => s.type === 'FunctionDeclaration') as
    | {
        id?: { name?: string } | null;
        params?: Array<{ type: string; name?: string }>;
      }
    | undefined;
  if (!fn || !fn.id?.name) return null;
  const params: string[] = [];
  for (const p of fn.params ?? []) {
    if (p.type !== 'Identifier' || !p.name) return null;
    params.push(p.name);
  }
  return { name: fn.id.name, params };
}

export function jsFunctionParams(source: string): string[] | null {
  return fnShape(source)?.params ?? null;
}

export function runJsFunction(source: string, args: unknown[]): TrialOutcome {
  if (source.length > MAX_SOURCE) return { outcome: 'unsupported', reason: 'source quá dài' };
  const shape = fnShape(source);
  if (!shape) return { outcome: 'unsupported', reason: 'cần một FunctionDeclaration' };
  const sandbox: Record<string, unknown> = {
    __tt_args: args,
    // Chặn chuỗi thoát qua global: this.constructor.constructor -> TypeError.
    constructor: undefined,
  };
  const code = `${source}\ntry { __tt_result = ${shape.name}(...__tt_args); } catch (e) { __tt_threw = e; }`;
  try {
    vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
    vm.runInContext(code, sandbox, { timeout: 500 });
  } catch (err) {
    return { outcome: 'unsupported', reason: (err as Error).message };
  }
  const threw = sandbox.__tt_threw as { name?: string; message?: string } | undefined;
  if (threw) {
    const name = threw.name ?? 'Error';
    // TypeError/RangeError thường do đối số suy ra không khớp hoặc đệ quy vô hạn,
    // ReferenceError do thiếu tên ngoài sandbox, EvalError do cấm sinh code từ chuỗi:
    // đều không phải oracle đáng tin.
    if (['ReferenceError', 'SyntaxError', 'TypeError', 'RangeError', 'EvalError'].includes(name)) {
      return { outcome: 'unsupported', reason: threw.message ?? name };
    }
    return { outcome: 'threw', name, message: threw.message ?? '' };
  }
  return { outcome: 'returned', value: sandbox.__tt_result };
}

export function formatTrialValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    const text = JSON.stringify(value) ?? String(value);
    return text.length > 200 ? `${text.slice(0, 200)}...` : text;
  } catch {
    return String(value);
  }
}
