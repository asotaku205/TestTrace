// Quét missing keys i18n: mọi namespace/key phải có đủ vi + en (nguồn: I18N-01).
import { describe, expect, it } from 'vitest';
import { STRINGS, missingKeys, t } from './i18n.js';

describe('i18n', () => {
  it('không thiếu key nào', () => {
    expect(missingKeys()).toEqual([]);
  });

  it('mọi key đều dịch được cả hai ngôn ngữ', () => {
    for (const ns of Object.keys(STRINGS) as Array<keyof typeof STRINGS>) {
      const table = STRINGS[ns] as Record<string, { vi: string; en: string }>;
      for (const key of Object.keys(table)) {
        expect(t('vi', ns, key).length).toBeGreaterThan(0);
        expect(t('en', ns, key).length).toBeGreaterThan(0);
      }
    }
  });
});
