// Test builder CSV: escape dấu phẩy/nháy/xuống dòng (nguồn: REPORT-01).
import { describe, expect, it } from 'vitest';
import { toCsv } from './csv.js';

describe('toCsv', () => {
  it('header + rows phân cách phẩy', () => {
    expect(toCsv(['code', 'status'], [{ code: 'REQ-001', status: 'TRUSTED' }])).toBe(
      'code,status\nREQ-001,TRUSTED\n',
    );
  });

  it('escape giá trị có phẩy, nháy, xuống dòng', () => {
    expect(toCsv(['title'], [{ title: 'a,b"c\nd' }])).toBe('title\n"a,b""c\nd"\n');
  });

  it('rỗng thì chỉ có header', () => {
    expect(toCsv(['code'], [])).toBe('code\n');
  });
});
