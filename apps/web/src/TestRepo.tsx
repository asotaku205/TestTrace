// UI tối thiểu kho test: suite, case, steps, READY/clone/retire, search (nguồn: TEST-01).
import { useCallback, useEffect, useState } from 'react';

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

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

export function TestRepo({ projectId }: { projectId: string }) {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [suiteName, setSuiteName] = useState('');
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<TestCaseDetail | null>(null);
  const [stepAction, setStepAction] = useState('');
  const [reqId, setReqId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/suites`, { headers: headers() }),
      fetch(`/api/projects/${projectId}/test-cases${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
        headers: headers(),
      }),
    ]);
    if (sRes.ok) setSuites((await sRes.json()) as Suite[]);
    if (cRes.ok) setCases((await cRes.json()) as TestCase[]);
  }, [projectId, q]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function loadDetail(id: string): Promise<void> {
    const res = await fetch(`/api/projects/${projectId}/test-cases/${id}`, { headers: headers() });
    if (res.ok) setSelected((await res.json()) as TestCaseDetail);
  }

  async function post(path: string, body?: unknown): Promise<boolean> {
    setError(null);
    const res = await fetch(path, {
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
      await reload();
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
      await loadDetail(selected.id);
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
      await loadDetail(selected.id);
      await reload();
    }
  }

  async function act(path: string): Promise<void> {
    if (await post(path)) {
      await reload();
      if (selected) await loadDetail(selected.id);
    }
  }

  return (
    <div>
      <h4>Kho test</h4>
      <div>
        <input
          value={suiteName}
          onChange={(e) => setSuiteName(e.target.value)}
          placeholder="Tên suite"
        />
        <button type="button" onClick={() => void createSuite()}>
          Tạo suite
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
          placeholder="Tiêu đề test"
        />
        <button type="button" onClick={() => void createCase()}>
          Tạo test
        </button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã/tiêu đề" />
        <button type="button" onClick={() => void reload()}>
          Tìm
        </button>
        <ul>
          {cases.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => void loadDetail(c.id)}>
                {c.code} {c.title} [{c.status}]
              </button>
            </li>
          ))}
        </ul>
      </div>
      {selected && (
        <div>
          <h5>
            {selected.code} {selected.title}
          </h5>
          <p>
            Trạng thái: {selected.status} | Ưu tiên: {selected.priority}
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
            placeholder="Thêm step"
          />
          <button type="button" onClick={() => void addStep()}>
            Thêm step
          </button>
          <div>
            <input
              value={reqId}
              onChange={(e) => setReqId(e.target.value)}
              placeholder="Requirement ID để gắn link"
            />
            <button type="button" onClick={() => void attach()}>
              Gắn requirement
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => void act(`/api/projects/${projectId}/test-cases/${selected.id}/ready`)}
            >
              Duyệt READY
            </button>{' '}
            <button
              type="button"
              onClick={() => void act(`/api/projects/${projectId}/test-cases/${selected.id}/clone`)}
            >
              Clone
            </button>{' '}
            <button
              type="button"
              onClick={() =>
                void act(`/api/projects/${projectId}/test-cases/${selected.id}/retire`)
              }
            >
              Retire
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert">Lỗi: {error}</p>}
    </div>
  );
}
