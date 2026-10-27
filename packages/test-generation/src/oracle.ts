// Suy input cụ thể thỏa predicates của 1 path (engine theo luật, nguồn: GEN-ORACLE-01).
// Predicate do predicatesForPath sinh: "if `COND` is true|false|taken".
// Chỉ giải điều kiện so sánh đơn: ident OP số, số OP ident, ident.length OP số,
// ident === 'chuỗi', ident trần (truthiness), phủ định !, ngoặc thừa.
// Điều kiện ghép (&&, ||), dạng khác, hoặc ràng buộc mâu thuẫn -> null:
// giữ hành vi cũ là cần người điền, không đoán mò.
export type SolvedInputs = Record<string, unknown>;

interface NumBounds {
  lo?: { value: number; inclusive: boolean };
  hi?: { value: number; inclusive: boolean };
  eq?: number;
  neq?: Set<number>;
}

interface StrBounds {
  eq?: string;
  neq?: Set<string>;
}

const COMPARE = /^(.*?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.*)$/;
const NUMBER = /^-?\d+(?:\.\d+)?$/;
const STRING = /^'([^']*)'$|^"([^"]*)"$/;
const IDENT = /^[A-Za-z_$][\w$]*$/;
const LENGTH = /^([A-Za-z_$][\w$]*)\.length$/;

function stripParens(text: string): string {
  let s = text.trim();
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0;
    let balanced = true;
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === '(') depth += 1;
      if (s[i] === ')') depth -= 1;
      if (depth === 0 && i < s.length - 1) {
        balanced = false;
        break;
      }
    }
    if (!balanced || depth !== 0) break;
    s = s.slice(1, -1).trim();
  }
  return s;
}

function negateOp(op: string): string {
  switch (op) {
    case '>':
      return '<=';
    case '<':
      return '>=';
    case '>=':
      return '<';
    case '<=':
      return '>';
    case '===':
    case '==':
      return '!==';
    case '!==':
    case '!=':
      return '===';
    default:
      return op;
  }
}

interface Atomic {
  key: string;
  op: string;
  literal?: number | string;
  otherKey?: string;
  isString: boolean;
}

function parseAtomic(condition: string): Atomic | null {
  const match = COMPARE.exec(condition);
  if (!match) {
    const bare = condition.trim();
    if (IDENT.test(bare)) return { key: bare, op: '!==', literal: 0, isString: false };
    return null;
  }
  const [, left, op, right] = match;
  const l = left.trim();
  const r = right.trim();
  const lNum = NUMBER.test(l) ? Number(l) : null;
  const rNum = NUMBER.test(r) ? Number(r) : null;
  const lStr = STRING.exec(l);
  const rStr = STRING.exec(r);
  const lLen = LENGTH.exec(l);
  const rLen = LENGTH.exec(r);
  const lKey = IDENT.test(l) ? l : lLen ? `${lLen[1]}.length` : null;
  const rKey = IDENT.test(r) ? r : rLen ? `${rLen[1]}.length` : null;
  const flip = (o: string): string => {
    switch (o) {
      case '>':
        return '<';
      case '<':
        return '>';
      case '>=':
        return '<=';
      case '<=':
        return '>=';
      default:
        return o;
    }
  };
  if (lKey && rNum !== null) return { key: lKey, op, literal: rNum, isString: false };
  if (lNum !== null && rKey) return { key: rKey, op: flip(op), literal: lNum, isString: false };
  if (lKey && rStr) return { key: lKey, op, literal: rStr[1] ?? rStr[2] ?? '', isString: true };
  if (lStr && rKey) return { key: rKey, op: flip(op), literal: lStr[1] ?? lStr[2] ?? '', isString: true };
  if (lKey && rKey) return { key: lKey, op, otherKey: rKey, isString: false };
  return null;
}

function applyNum(bounds: NumBounds, op: string, value: number): boolean {
  switch (op) {
    case '>':
      if (bounds.lo === undefined || value >= bounds.lo.value) bounds.lo = { value, inclusive: false };
      return true;
    case '>=':
      if (bounds.lo === undefined || value > bounds.lo.value) bounds.lo = { value, inclusive: true };
      return true;
    case '<':
      if (bounds.hi === undefined || value <= bounds.hi.value) bounds.hi = { value, inclusive: false };
      return true;
    case '<=':
      if (bounds.hi === undefined || value < bounds.hi.value) bounds.hi = { value, inclusive: true };
      return true;
    case '===':
    case '==':
      if (bounds.eq !== undefined && bounds.eq !== value) return false;
      bounds.eq = value;
      return true;
    case '!==':
    case '!=':
      (bounds.neq ??= new Set()).add(value);
      return true;
    default:
      return false;
  }
}

function pickNum(bounds: NumBounds): number | null {
  const candidates: number[] = [];
  if (bounds.eq !== undefined) {
    candidates.push(bounds.eq);
  } else {
    const base =
      bounds.lo !== undefined
        ? bounds.lo.inclusive
          ? bounds.lo.value
          : bounds.lo.value + 1
        : bounds.hi !== undefined
          ? bounds.hi.inclusive
            ? bounds.hi.value
            : bounds.hi.value - 1
          : 0;
    candidates.push(base, base + 1, base - 1, base + 2, base - 2, base + 3, base - 3);
  }
  for (const c of candidates) {
    if (bounds.lo !== undefined) {
      if (bounds.lo.inclusive ? c < bounds.lo.value : c <= bounds.lo.value) continue;
    }
    if (bounds.hi !== undefined) {
      if (bounds.hi.inclusive ? c > bounds.hi.value : c >= bounds.hi.value) continue;
    }
    if (bounds.eq !== undefined && c !== bounds.eq) continue;
    if (bounds.neq?.has(c)) continue;
    return c;
  }
  return null;
}

function pickStr(bounds: StrBounds): string | null {
  if (bounds.eq !== undefined) return bounds.eq;
  if (!bounds.neq?.has('sample')) return 'sample';
  if (!bounds.neq?.has('other')) return 'other';
  return null;
}

function evalAtomic(a: Atomic, solved: SolvedInputs): boolean {
  const l = solved[a.key];
  const r = a.otherKey !== undefined ? solved[a.otherKey] : a.literal;
  if (l === undefined || r === undefined) return false;
  switch (a.op) {
    case '>':
      return (l as number) > (r as number);
    case '<':
      return (l as number) < (r as number);
    case '>=':
      return (l as number) >= (r as number);
    case '<=':
      return (l as number) <= (r as number);
    case '===':
    case '==':
      return l === r;
    case '!==':
    case '!=':
      return l !== r;
    default:
      return false;
  }
}

export function solvePathInputs(predicates: string[]): SolvedInputs | null {
  const numBounds = new Map<string, NumBounds>();
  const strBounds = new Map<string, StrBounds>();
  const atomics: Atomic[] = [];
  const varVar: Atomic[] = [];
  for (const predicate of predicates) {
    const m = /^if `([^`]*)` is (true|false|taken)$/.exec(predicate.trim());
    if (!m) return null;
    let condition = stripParens(m[1]);
    let taken = m[2];
    let negated = false;
    while (condition.startsWith('!')) {
      condition = stripParens(condition.slice(1));
      negated = !negated;
    }
    if (negated) taken = taken === 'true' ? 'false' : taken === 'false' ? 'true' : taken;
    if (taken === 'taken') return null;
    const atomic = parseAtomic(condition);
    if (!atomic) return null;
    const op = taken === 'false' ? negateOp(atomic.op) : atomic.op;
    atomics.push({ ...atomic, op });
    if (atomic.otherKey !== undefined) {
      varVar.push({ ...atomic, op });
      continue;
    }
    if (atomic.isString) {
      const b = strBounds.get(atomic.key) ?? {};
      strBounds.set(atomic.key, b);
      if (op === '===' || op === '==') {
        if (b.eq !== undefined && b.eq !== atomic.literal) return null;
        b.eq = atomic.literal as string;
      } else if (op === '!==' || op === '!=') {
        (b.neq ??= new Set()).add(atomic.literal as string);
      } else {
        return null;
      }
    } else {
      const b = numBounds.get(atomic.key) ?? {};
      numBounds.set(atomic.key, b);
      if (!applyNum(b, op, atomic.literal as number)) return null;
    }
  }
  // Ràng buộc biến-đối-biến: chọn tạm giá trị cho vế phải từ ràng buộc literal
  // của nó rồi quy về ràng buộc literal; bước kiểm chứng cuối bắt mọi mâu thuẫn.
  for (const a of varVar) {
    const other = a.otherKey as string;
    if (strBounds.has(other)) {
      const provisional = pickStr(strBounds.get(other) ?? {}) ?? 'sample';
      const b = strBounds.get(a.key) ?? {};
      strBounds.set(a.key, b);
      if (a.op === '===' || a.op === '==') {
        if (b.eq !== undefined && b.eq !== provisional) return null;
        b.eq = provisional;
      } else if (a.op === '!==' || a.op === '!=') {
        (b.neq ??= new Set()).add(provisional);
      } else {
        return null;
      }
      continue;
    }
    const otherBounds = numBounds.get(other);
    const hasBounds =
      otherBounds !== undefined &&
      (otherBounds.lo !== undefined ||
        otherBounds.hi !== undefined ||
        otherBounds.eq !== undefined ||
        otherBounds.neq !== undefined);
    // Mặc định cho độ dài: `key < L` cần L >= 1 (biến đếm thường khởi tạo 0
    // trong hàm nên L = 0 sẽ làm vòng lặp bị bỏ qua khi chạy thật).
    const provisional = hasBounds ? (pickNum(otherBounds as NumBounds) ?? 0) : a.op === '<' ? 1 : 0;
    const ob = numBounds.get(other) ?? {};
    numBounds.set(other, ob);
    if (!applyNum(ob, '===', provisional)) return null;
    const b = numBounds.get(a.key) ?? {};
    numBounds.set(a.key, b);
    if (!applyNum(b, a.op, provisional)) return null;
  }
  const solved: SolvedInputs = {};
  for (const [key, b] of numBounds) {
    const picked = pickNum(b);
    if (picked === null) return null;
    if (key.endsWith('.length') && (!Number.isInteger(picked) || picked < 0)) return null;
    solved[key] = picked;
  }
  for (const [key, b] of strBounds) {
    const picked = pickStr(b);
    if (picked === null) return null;
    solved[key] = picked;
  }
  for (const key of varVar.map((a) => a.otherKey as string)) {
    if (solved[key] === undefined) solved[key] = 0;
  }
  if (!atomics.every((a) => evalAtomic(a, solved))) return null;
  return solved;
}

// Dựng mảng đối số vị trí từ tên tham số và map đã giải:
// ưu tiên `name.length` -> mảng dài tương ứng; thiếu ràng buộc -> mặc định 0.
export function materializeArgs(paramNames: string[], solved: SolvedInputs): unknown[] {
  return paramNames.map((name) => {
    const len = solved[`${name}.length`];
    if (typeof len === 'number' && Number.isInteger(len) && len >= 0) {
      return Array.from({ length: len }, () => 0);
    }
    if (solved[name] !== undefined) return solved[name];
    return 0;
  });
}
