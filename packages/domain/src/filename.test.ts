// Sanitize tên file evidence chống path traversal (nguồn: M08 + EVID-01).
import { describe, expect, it } from 'vitest';
import { sanitizeFilename } from './filename.js';

describe('sanitizeFilename', () => {
  it('giữ tên thường, thay khoảng trắng và ký tự lạ', () => {
    expect(sanitizeFilename('anh loi 1.png')).toBe('anh_loi_1.png');
  });

  it('bóc đường dẫn traversal chỉ giữ basename', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\windows\\x.png')).toBe('x.png');
  });

  it('tên rỗng hoặc chỉ chấm thì ném EVIDENCE_FILENAME', () => {
    for (const bad of ['', '.', '..', '   ']) {
      expect(() => sanitizeFilename(bad)).toThrowError(
        expect.objectContaining({ code: 'EVIDENCE_FILENAME' }),
      );
    }
  });

  it('giữ nguyên phần mở rộng', () => {
    expect(sanitizeFilename('log.TXT')).toBe('log.TXT');
  });
});
