// Corpus Python hợp lệ qua bridge; chưa adapter nào xanh (nguồn: CORPUS-PY-01).
// Trạng thái đỏ của runner được chứng minh bằng adapter JS chạy sai trên source Python.
import { describe, expect, it } from 'vitest';
import { createGraph } from '@testtrace/cfg-core';
import { parsePython } from '@testtrace/language-python';
import { runContractSuite } from './runner.js';
import { pyFixtures, pyNegativeFixtures } from './fixtures-python.js';

describe('python corpus', () => {
  it('mọi fixture dương đều là Python hợp lệ', async () => {
    for (const fixture of pyFixtures) {
      const tree = await parsePython(fixture.source);
      expect(tree.body[0]._type).toBe('FunctionDef');
    }
  });

  it('negative syntax-error parse lỗi qua bridge', async () => {
    const bad = pyNegativeFixtures.find((f) => f.id === 'py-syntax-error');
    await expect(parsePython(bad?.source ?? '')).rejects.toMatchObject({ code: 'PY_SYNTAX' });
  });

  it('đang đỏ: chưa adapter nào qua được corpus Python', () => {
    const notAdapter = {
      id: 'none',
      versions: [],
      buildControlFlow: () => createGraph(),
      locate: () => null,
      capabilities: () => ({
        sequence: false,
        branch: false,
        loop: false,
        earlyReturn: false,
        exceptionFlow: false,
        asyncGenerator: false,
        preprocessor: false,
      }),
    };
    const results = runContractSuite(notAdapter, pyFixtures);
    expect(results.every((r) => !r.pass)).toBe(true);
  });
});
