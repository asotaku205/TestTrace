// Test trích code units Python (nguồn: REG-01).
import { describe, expect, it } from 'vitest';
import { extractUnits } from './units.js';

describe('extractUnits', () => {
  it('trích tên và params function', async () => {
    const units = await extractUnits('def fee(total, rate):\n    return total * rate\n');
    expect(units).toEqual([{ name: 'fee', signature: 'fee(total,rate)' }]);
  });

  it('cùng tên khác thân thì signature giữ nguyên', async () => {
    const a = await extractUnits('def fee(total):\n    return 0\n');
    const b = await extractUnits('def fee(total):\n    return total\n');
    expect(a).toEqual(b);
  });
});
