// Cầu stdlib ast Python: chỉ parse tĩnh qua stdin, không eval, timeout kill (nguồn: CONTRACT-01).
import { spawn } from 'node:child_process';

export interface PythonNode {
  _type: string;
  [key: string]: unknown;
}

export interface PythonModule {
  _type: 'Module';
  body: PythonNode[];
}

export interface BridgeOptions {
  timeoutMs?: number;
  pythonPath?: string;
}

const HELPER = `
import ast, json, sys
def conv(n):
    if isinstance(n, ast.AST):
        d = {'_type': type(n).__name__}
        for f, v in ast.iter_fields(n):
            d[f] = conv(v)
        for attr in ('lineno', 'col_offset', 'end_lineno', 'end_col_offset'):
            if hasattr(n, attr):
                d['@' + attr] = getattr(n, attr)
        return d
    if isinstance(n, list):
        return [conv(x) for x in n]
    if isinstance(n, (str, int, float, bool)) or n is None:
        return n
    if isinstance(n, bytes):
        try:
            return n.decode('utf-8')
        except Exception:
            return repr(n)
    return {'_type': type(n).__name__}
try:
    src = sys.stdin.read()
    tree = ast.parse(src)
    print(json.dumps({'ok': True, 'tree': conv(tree)}))
except SyntaxError as e:
    print(json.dumps({'ok': False, 'error': {'message': str(e), 'line': e.lineno, 'column': e.offset}}))
`;

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

export function parsePython(source: string, opts: BridgeOptions = {}): Promise<PythonModule> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const pythonPath = opts.pythonPath ?? process.env.PYTHON_PATH ?? 'python';
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, ['-c', HELPER], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(
          Object.assign(new Error(`Parse Python quá ${timeoutMs}ms, đã kill tiến trình`), {
            code: 'BRIDGE_TIMEOUT',
          }),
        );
      }
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(
          Object.assign(new Error(`Không chạy được Python (${err.message})`), {
            code: 'BRIDGE_NO_PYTHON',
          }),
        );
      }
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          Object.assign(new Error(`Python exit ${code}: ${stderr.slice(0, 200)}`), {
            code: 'BRIDGE_FAILED',
          }),
        );
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as
          | { ok: true; tree: PythonModule }
          | { ok: false; error: { message: string; line: number | null; column: number | null } };
        if (!parsed.ok) {
          reject(
            Object.assign(new Error(`Cú pháp Python lỗi: ${parsed.error.message}`), {
              code: 'PY_SYNTAX',
              ...parsed.error,
            }),
          );
          return;
        }
        resolve(parsed.tree);
      } catch {
        reject(Object.assign(new Error('Không đọc được AST từ Python'), { code: 'BRIDGE_FAILED' }));
      }
    });
    child.stdin.write(source, 'utf8');
    child.stdin.end();
  });
}
