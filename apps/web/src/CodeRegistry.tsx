// UI tối thiểu code registry: artifacts, versions, link requirement (nguồn: REG-01).
import { useCallback, useEffect, useState } from 'react';

interface CodeUnit {
  qualifiedName: string;
  signatureHash: string;
}

interface CodeVersion {
  id: string;
  sourceHash: string;
  units: CodeUnit[];
}

interface Artifact {
  id: string;
  language: string;
  name: string;
  versions: Array<{ id: string }>;
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

export function CodeRegistry({ projectId }: { projectId: string }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [versions, setVersions] = useState<Record<string, CodeVersion[]>>({});
  const [requirementId, setRequirementId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/projects/${projectId}/code`, { headers: headers() });
    if (res.ok) setArtifacts((await res.json()) as Artifact[]);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function openArtifact(id: string): Promise<void> {
    const res = await fetch(`/api/projects/${projectId}/code/${id}/versions`, {
      headers: headers(),
    });
    if (res.ok) {
      const data = (await res.json()) as CodeVersion[];
      setVersions((prev) => ({ ...prev, [id]: data }));
    }
  }

  async function linkRequirement(artifactId: string, qualifiedName: string): Promise<void> {
    setError(null);
    if (!requirementId.trim()) {
      setError('Nhập requirement ID trước');
      return;
    }
    const res = await fetch(
      `/api/projects/${projectId}/requirements/${requirementId.trim()}/code-units`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ artifactId, qualifiedName }),
      },
    );
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
    }
  }

  return (
    <div>
      <h4>Code registry</h4>
      <button type="button" onClick={() => void reload()}>
        Tải lại registry
      </button>
      <input
        value={requirementId}
        onChange={(e) => setRequirementId(e.target.value)}
        placeholder="Requirement ID để gắn unit"
      />
      <ul>
        {artifacts.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => void openArtifact(a.id)}>
              {a.name} [{a.language}] ({a.versions.length} versions)
            </button>
            <ul>
              {(versions[a.id] ?? []).map((v) => (
                <li key={v.id}>
                  {v.sourceHash.slice(0, 8)}
                  <ul>
                    {v.units.map((u) => (
                      <li key={u.qualifiedName}>
                        {u.qualifiedName}{' '}
                        <button
                          type="button"
                          onClick={() => void linkRequirement(a.id, u.qualifiedName)}
                        >
                          Gắn unit
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {error && <p role="alert">Lỗi: {error}</p>}
    </div>
  );
}
