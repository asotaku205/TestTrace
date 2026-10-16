// UI tối thiểu impact: chọn 2 version, xem diff + regression có lý do (nguồn: IMPACT-01).
import { useCallback, useEffect, useState } from 'react';
import { t } from './i18n.js';
import { useLang } from './lang.js';

interface Artifact {
  id: string;
  name: string;
}

interface CodeVersion {
  id: string;
  sourceHash: string;
}

interface ImpactedTest {
  testCaseId: string;
  code: string;
  title: string;
  requirementId: string;
  reasonCodes: string[];
}

interface ImpactResult {
  matches: Array<{ status: string; oldName: string | null; newName: string | null }>;
  graphDiff: {
    addedNodes: string[];
    removedNodes: string[];
    modifiedNodes: Array<{ id: string; change: string }>;
  };
  complexityDelta: number;
  impactedTests: ImpactedTest[];
}

import { authHeaders as headers, apiFetch } from './lib/api.js';

export function Impact({ projectId }: { projectId: string }) {
  const lang = useLang();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactId, setArtifactId] = useState('');
  const [versions, setVersions] = useState<CodeVersion[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const res = await apiFetch(`/api/projects/${projectId}/code`, { headers: headers() });
    if (res.ok) setArtifacts((await res.json()) as Artifact[]);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function loadVersions(id: string): Promise<void> {
    setArtifactId(id);
    const res = await apiFetch(`/api/projects/${projectId}/code/${id}/versions`, {
      headers: headers(),
    });
    if (res.ok) setVersions((await res.json()) as CodeVersion[]);
  }

  async function compare(): Promise<void> {
    setError(null);
    const res = await apiFetch(`/api/projects/${projectId}/impact`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ fromVersionId: from, toVersionId: to }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    setResult((await res.json()) as ImpactResult);
  }

  return (
    <div>
      <h4>{t(lang, 'impact', 'title')}</h4>
      <button type="button" onClick={() => void reload()}>
        {t(lang, 'impact', 'reload')}
      </button>
      <select value={artifactId} onChange={(e) => void loadVersions(e.target.value)}>
        <option value="">{t(lang, 'impact', 'pickArtifact')}</option>
        {artifacts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <select value={from} onChange={(e) => setFrom(e.target.value)}>
        <option value="">{t(lang, 'impact', 'oldVersion')}</option>
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.sourceHash.slice(0, 8)}
          </option>
        ))}
      </select>
      <select value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="">{t(lang, 'impact', 'newVersion')}</option>
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.sourceHash.slice(0, 8)}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => void compare()}>
        {t(lang, 'impact', 'compare')}
      </button>
      {result && (
        <div>
          <p>
            {t(lang, 'impact', 'added')}: {result.graphDiff.addedNodes.length} |{' '}
            {t(lang, 'impact', 'removed')}: {result.graphDiff.removedNodes.length} |{' '}
            {t(lang, 'impact', 'modified')}:{' '}
            {result.graphDiff.modifiedNodes.map((m) => `${m.id}(${m.change})`).join(', ') || '—'} |
            Delta complexity: {result.complexityDelta}
          </p>
          <h5>
            {t(lang, 'impact', 'regression')} ({result.impactedTests.length})
          </h5>
          <ul>
            {result.impactedTests.map((t) => (
              <li key={t.testCaseId}>
                {t.code} {t.title} [{t.reasonCodes.join(', ')}]
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert">
          {t(lang, 'impact', 'error')} {error}
        </p>
      )}
    </div>
  );
}
