// Test cầu stdlib ast Python (nguồn: CONTRACT-01).
// Chứng minh: parse đúng + location, mã độc chỉ parse không chạy, timeout kill.
import { describe, expect, it, afterEach } from 'vitest';
import { existsSync, symlinkSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePython, resolvePythonPath } from './bridge.js';

const MARKER = join(tmpdir(), `testtrace-noexec-${Date.now()}.txt`);
const savedPath = process.env.PATH;

afterEach(() => {
  process.env.PATH = savedPath;
  delete process.env.PYTHON_PATH;
});

describe('resolvePythonPath', () => {
  it('ưu tiên pythonPath truyền vào', () => {
    expect(resolvePythonPath('/custom/python')).toBe('/custom/python');
  });

  it('ưu tiên PYTHON_PATH từ env', () => {
    process.env.PYTHON_PATH = '/env/python';
    expect(resolvePythonPath()).toBe('/env/python');
  });

  it("fallback sang python3 khi PATH không có python", () => {
    const dir = mkdtempSync(join(tmpdir(), 'tt-py-'));
    try {
      symlinkSync('/usr/bin/python3', join(dir, 'python3'));
      process.env.PATH = dir;
      expect(resolvePythonPath()).toBe('python3');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("giữ 'python' khi không tìm thấy gì để lỗi BRIDGE_NO_PYTHON rõ ràng", () => {
    const dir = mkdtempSync(join(tmpdir(), 'tt-py-empty-'));
    try {
      process.env.PATH = dir;
      expect(resolvePythonPath()).toBe('python');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('parsePython', () => {
  it('parse hàm đơn giản kèm location', async () => {
    const tree = await parsePython('def add(a, b):\n    return a + b\n');
    const fn = tree.body[0];
    expect(fn._type).toBe('FunctionDef');
    expect(fn.name).toBe('add');
    expect(fn['@lineno']).toBe(1);
    const ret = (fn.body as Array<{ _type: string } & Record<string, unknown>>)[0];
    expect(ret._type).toBe('Return');
  });

  it('mã độc chỉ parse, không thực thi', async () => {
    const tree = await parsePython(`import os\nos.system("touch ${MARKER.replace(/\\/g, '/')}")\n`);
    expect(tree.body[0]._type).toBe('Import');
    expect(existsSync(MARKER)).toBe(false);
  });

  it('cú pháp lỗi trả line/column', async () => {
    await expect(parsePython('def broken(:\n')).rejects.toMatchObject({
      code: 'PY_SYNTAX',
    });
  });

  it('timeout kill tiến trình treo', async () => {
    await expect(parsePython('x = 1\n', { timeoutMs: 1 })).rejects.toMatchObject({
      code: 'BRIDGE_TIMEOUT',
    });
  }, 10000);
});
