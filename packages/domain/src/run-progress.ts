// Progress realtime: done/total thực tế, rỗng thì percent null (nguồn: plan M06 + RUN-02).
export interface RunProgress {
  done: number;
  total: number;
  percent: number | null;
}

export function runProgress(doneFlags: boolean[]): RunProgress {
  const total = doneFlags.length;
  const done = doneFlags.filter(Boolean).length;
  return { done, total, percent: total === 0 ? null : Math.round((done / total) * 100) };
}
