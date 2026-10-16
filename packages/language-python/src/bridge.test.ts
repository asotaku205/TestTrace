// Test cầu stdlib ast Python (nguồn: CONTRACT-01).
// Chứng minh: parse đúng + location, mã độc chỉ parse không chạy, timeout kill.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePython } from './bridge.js';

const MARKER = join(tmpdir(), `testtrace-noexec-${Date.now()}.txt`);

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
