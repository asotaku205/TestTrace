import { t } from '../../i18n.js';
import { useLang } from '../../lang.js';

// Phân trang dùng chung (cùng cỡ trang 20 với AuditLog).
export const PAGE_SIZE = 20;

export function Pager({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const lang = useLang();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t(lang, 'pager', 'prev')}
      </button>{' '}
      <span>
        {t(lang, 'pager', 'page')} {page} / {totalPages}
      </span>{' '}
      <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        {t(lang, 'pager', 'next')}
      </button>
    </div>
  );
}
