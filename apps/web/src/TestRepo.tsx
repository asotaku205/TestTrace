// UI tối thiểu kho test: suite, case, steps, READY/clone/retire, search (nguồn: TEST-01).
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from './i18n.js';
import { useLang } from './lang.js';

interface Suite {
  id: string;
  name: string;
  parentId: string | null;
}

interface Step {
  id: string;
  action: string;
  expected: string | null;
  position: number;
}

interface TestCase {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  expectedResult: string | null;
  tags: string[];
}

interface TestCaseDetail extends TestCase {
  steps: Step[];
  linkedRequirements: Array<{ id: string; code: string; title: string; status: string }>;
}

import { authHeaders as headers, apiFetch } from './lib/api.js';
import { Modal } from './components/ui/modal.js';
import { PAGE_SIZE, Pager } from './components/ui/pager.js';
import { toast } from 'sonner';

export function TestRepo({ projectId }: { projectId: string }) {
  const lang = useLang();
  const [suites, setSuites] = useState<Suite[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [suiteName, setSuiteName] = useState('');
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<TestCaseDetail | null>(null);
  const [stepAction, setStepAction] = useState('');
  const [expected, setExpected] = useState('');
  const [reqId, setReqId] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Case đang mở modal: refresh chạy ngầm xong muộn không được mở lại modal
  // đã đóng, và detail cũ không được đè lên case mới mở sau.
  const openIdRef = useRef<string | null>(null);

  const reload = useCallback(async (): Promise<number> => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) params.set('q', q);
    const [sRes, cRes] = await Promise.all([
      apiFetch(`/api/projects/${projectId}/suites`, { headers: headers() }),
      apiFetch(`/api/projects/${projectId}/test-cases?${params.toString()}`, {
        headers: headers(),
      }),
    ]);
    if (sRes.ok) setSuites((await sRes.json()) as Suite[]);
    let totalCount = 0;
    if (cRes.ok) {
      const body = (await cRes.json()) as { items: TestCase[]; total: number };
      setCases(body.items);
      setTotal(body.total);
      totalCount = body.total;
    }
    return totalCount;
  }, [projectId, q, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function fetchDetail(id: string): Promise<void> {
    const res = await apiFetch(`/api/projects/${projectId}/test-cases/${id}`, { headers: headers() });
    if (res.ok && openIdRef.current === id) {
      const detail = (await res.json()) as TestCaseDetail;
      setSelected(detail);
      setExpected(detail.expectedResult ?? '');
    }
  }

  // Mở modal: đánh dấu case đang mở rồi mới tải.
  async function openDetail(id: string): Promise<void> {
    openIdRef.current = id;
    await fetchDetail(id);
  }

  // Refresh sau thao tác trong modal: không tự mở lại nếu user đã đóng.
  async function refreshDetail(id: string): Promise<void> {
    await fetchDetail(id);
  }

  function closeDetail(): void {
    openIdRef.current = null;
    setSelected(null);
  }

  async function post(path: string, body?: unknown): Promise<boolean> {
    setError(null);
    const res = await apiFetch(path, {
      method: 'POST',
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return false;
    }
    return true;
  }

  async function createSuite(): Promise<void> {
    if (await post(`/api/projects/${projectId}/suites`, { name: suiteName })) {
      setSuiteName('');
      await reload();
    }
  }

  async function createCase(): Promise<void> {
    if (await post(`/api/projects/${projectId}/test-cases`, { title })) {
      setTitle('');
      const totalCount = await reload();
      // Case mới nằm cuối danh sách nên nhảy tới trang cuối để thấy.
      const lastPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      if (lastPage !== page) setPage(lastPage);
    }
  }

  async function addStep(): Promise<void> {
    if (!selected || !stepAction.trim()) return;
    if (
      await post(`/api/projects/${projectId}/test-cases/${selected.id}/steps`, {
        action: stepAction,
      })
    ) {
      setStepAction('');
      await refreshDetail(selected.id);
    }
  }

  async function attach(): Promise<void> {
    if (!selected || !reqId.trim()) return;
    if (
      await post(`/api/projects/${projectId}/test-cases/${selected.id}/links`, {
        requirementId: reqId.trim(),
      })
    ) {
      setReqId('');
      await refreshDetail(selected.id);
      await reload();
    }
  }

  async function act(path: string, doneKey: 'readyDone' | 'cloneDone' | 'retireDone'): Promise<void> {
    if (await post(path)) {
      toast.success(t(lang, 'testrepo', doneKey));
      await reload();
      if (selected) await refreshDetail(selected.id);
    }
  }

  return (
    <div>
      <h4>{t(lang, 'testrepo', 'title')}</h4>
      <div>
        <input
          value={suiteName}
          onChange={(e) => setSuiteName(e.target.value)}
          placeholder={t(lang, 'testrepo', 'suitePlaceholder')}
        />
        <button type="button" onClick={() => void createSuite()}>
          {t(lang, 'testrepo', 'createSuite')}
        </button>
        <ul>
          {suites.map((s) => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ul>
      </div>
      <div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t(lang, 'testrepo', 'titlePlaceholder')}
        />
        <button type="button" onClick={() => void createCase()}>
          {t(lang, 'testrepo', 'createCase')}
        </button>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={t(lang, 'testrepo', 'searchPlaceholder')}
        />
        <button type="button" onClick={() => void reload()}>
          {t(lang, 'testrepo', 'search')}
        </button>
        <ul>
          {cases.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => void openDetail(c.id)}>
                {c.code} {c.title} [{c.status}]
              </button>
            </li>
          ))}
        </ul>
        <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>
      <Modal
        open={selected !== null}
        onClose={closeDetail}
        title={selected ? `${selected.code} ${selected.title}` : ''}
      >
        {selected && (
          <div>
          <p>
            {t(lang, 'testrepo', 'status')}: {selected.status} | {t(lang, 'testrepo', 'priority')}:{' '}
            {selected.priority}
          </p>
          {(selected.linkedRequirements ?? []).length > 0 && (
            <p>
              Requirement:{' '}
              {(selected.linkedRequirements ?? []).map((r) => `${r.code}[${r.status}]`).join(', ')}
            </p>
          )}
          <ol>
            {selected.steps.map((s) => (
              <li key={s.id}>
                {s.action}
                {s.expected ? ` → ${s.expected}` : ''}
              </li>
            ))}
          </ol>
          <input
            value={stepAction}
            onChange={(e) => setStepAction(e.target.value)}
            placeholder={t(lang, 'testrepo', 'stepPlaceholder')}
          />
          <button type="button" onClick={() => void addStep()}>
            {t(lang, 'testrepo', 'addStep')}
          </button>
          <div>
            <input
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              placeholder="Expected result"
            />
            <button
              type="button"
              onClick={() =>
                void (async () => {
                  if (!selected) return;
                  await apiFetch(`/api/projects/${projectId}/test-cases/${selected.id}`, {
                    method: 'PATCH',
                    headers: headers(),
                    body: JSON.stringify({ expectedResult: expected }),
                  });
                  await refreshDetail(selected.id);
                })()
              }
            >
              {t(lang, 'testrepo', 'saveExpected')}
            </button>
          </div>
          <div>
            <input
              value={reqId}
              onChange={(e) => setReqId(e.target.value)}
              placeholder={t(lang, 'testrepo', 'linkPlaceholder')}
            />
            <button type="button" onClick={() => void attach()}>
              {t(lang, 'testrepo', 'attach')}
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => void act(`/api/projects/${projectId}/test-cases/${selected.id}/ready`, 'readyDone')}
            >
              {t(lang, 'testrepo', 'ready')}
            </button>{' '}
            <button
              type="button"
              onClick={() => void act(`/api/projects/${projectId}/test-cases/${selected.id}/clone`, 'cloneDone')}
            >
              {t(lang, 'testrepo', 'clone')}
            </button>{' '}
            <button
              type="button"
              onClick={() =>
                void act(`/api/projects/${projectId}/test-cases/${selected.id}/retire`, 'retireDone')
              }
            >
              {t(lang, 'testrepo', 'retire')}
            </button>
          </div>
          </div>
        )}
      </Modal>
      {error && (
        <p role="alert">
          {t(lang, 'testrepo', 'error')} {error}
        </p>
      )}
    </div>
  );
}
