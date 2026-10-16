// Sanitize tên file: basename, thay ký tự lạ, giữ extension (nguồn: plan M08 + EVID-01).
export function sanitizeFilename(raw: string): string {
  const segments = raw
    .split(/[\\/]/)
    .filter((part) => part !== '' && part !== '.' && part !== '..');
  const base = segments.length > 0 ? segments[segments.length - 1] : '';
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw Object.assign(new Error('Tên file không hợp lệ'), { code: 'EVIDENCE_FILENAME' });
  }
  return cleaned;
}
