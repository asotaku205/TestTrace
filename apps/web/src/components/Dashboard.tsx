import { useEffect, useState } from 'react';
import { ArrowRight, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { t, type Language } from '../i18n.js';
import { Card, CardHeader, CardTitle } from './ui/card.js';
import { Badge } from './ui/badge.js';

import { authHeaders as headers, apiFetch } from '../lib/api.js';

interface Requirement {
  id: string;
  code: string;
  title: string;
  status: string;
  score: number | null;
}
interface TestCase {
  id: string;
  code: string;
  status: string;
}
interface Run {
  id: string;
  name: string;
  status: string;
  items?: Array<{ results?: Array<{ status?: string }> }>;
}
interface Defect {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
}
interface RtmRow {
  requirementId: string;
  code: string;
  title: string;
  status: 'TRUSTED' | 'STALE' | 'AT_RISK' | 'UNCOVERED';
}
interface Gate {
  id: string;
  name: string;
}
interface GateEval {
  verdict: string;
  results: Array<{ rule: string; status: string; expected?: unknown; actual?: unknown }>;
  createdAt: string;
}
interface AuditEvent {
  id: string;
  action: string;
  actorId: string;
  createdAt: string;
}

async function get<T>(url: string): Promise<T | null> {
  try {
    const res = await apiFetch(url, { headers: headers() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function verdictBadge(v: string) {
  if (v === 'PASS') return <Badge variant="success">PASS</Badge>;
  if (v === 'FAIL') return <Badge variant="danger">FAIL</Badge>;
  return <Badge variant="warning">{v}</Badge>;
}

function rtmBadge(s: RtmRow['status'], lang: Language) {
  const map = { TRUSTED: 'success', STALE: 'warning', AT_RISK: 'danger', UNCOVERED: 'secondary' } as const;
  return <Badge variant={map[s]}>{t(lang, 'rtm', s.toLowerCase() as never) || s}</Badge>;
}

export function Dashboard({ projectId, lang, onGoToTab }: { projectId: string; lang: Language; onGoToTab: (tab: string) => void }) {
  const [reqs, setReqs] = useState<Requirement[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [rtm, setRtm] = useState<RtmRow[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [lastEval, setLastEval] = useState<{ gate: string; eval: GateEval } | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [trend, setTrend] = useState<Array<{ name: string; pass: number; total: number; rate: number }>>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [r, c, rn, d, m, g, a] = await Promise.all([
        get<Requirement[]>(`/api/projects/${projectId}/requirements`),
        get<TestCase[]>(`/api/projects/${projectId}/test-cases`),
        get<Run[]>(`/api/projects/${projectId}/runs`),
        get<Defect[]>(`/api/projects/${projectId}/defects`),
        get<RtmRow[]>(`/api/projects/${projectId}/rtm`),
        get<Gate[]>(`/api/projects/${projectId}/gates`),
        get<{ items: AuditEvent[] }>(`/api/projects/${projectId}/audit?limit=6`),
      ]);
      if (!alive) return;
      if (Array.isArray(r)) setReqs(r);
      if (Array.isArray(c)) setCases(c);
      if (Array.isArray(d)) setDefects(d);
      if (Array.isArray(m)) setRtm(m);
      if (Array.isArray(g)) setGates(g);
      if (a && Array.isArray(a.items)) setAudit(a.items);
      if (g && g.length > 0) {
        const ev = await get<GateEval[]>(`/api/projects/${projectId}/gates/${g[0].id}/evaluations`);
        if (alive && Array.isArray(ev) && ev.length > 0) setLastEval({ gate: g[0].name, eval: ev[0] });
      }
      // Xu hướng pass: chi tiết 5 lượt chạy FINALIZED gần nhất
      const fin = (rn ?? []).filter((x) => x.status === 'FINALIZED').slice(-5);
      const details = await Promise.all(
        fin.map((x) => get<Run>(`/api/projects/${projectId}/runs/${x.id}`)),
      );
      if (!alive) return;
      const points = details
        .map((det, i) => {
          if (!det?.items) return null;
          const decided = det.items.filter((it) => it.results && it.results.length > 0);
          const passed = decided.filter((it) => it.results![0].status === 'PASS').length;
          return {
            name: fin[i].name.length > 14 ? fin[i].name.slice(0, 13) + '…' : fin[i].name,
            pass: passed,
            total: decided.length,
            rate: decided.length ? Math.round((passed / decided.length) * 100) : 0,
          };
        })
        .filter((p): p is { name: string; pass: number; total: number; rate: number } => p !== null);
      setTrend(points);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  const readyCases = cases.filter((c) => c.status === 'READY').length;
  const openDefects = defects.filter((d) => !['CLOSED', 'REJECTED'].includes(d.status));
  const critical = openDefects.filter((d) => ['BLOCKER', 'CRITICAL'].includes(d.severity)).length;
  const passRate = trend.length > 0 ? trend[trend.length - 1].rate : null;
  const rtmCounts = {
    TRUSTED: rtm.filter((r) => r.status === 'TRUSTED').length,
    STALE: rtm.filter((r) => r.status === 'STALE').length,
    AT_RISK: rtm.filter((r) => r.status === 'AT_RISK').length,
    UNCOVERED: rtm.filter((r) => r.status === 'UNCOVERED').length,
  };
  const total = rtm.length || 1;
  const highRisk = [...reqs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);

  // Donut segments: butt caps để độ dài cung khớp đúng tỉ lệ số lượng; trạng
  // thái 0 không vẽ gì (round cap trước đây vẽ thành 1 chấm dù count = 0, và
  // làm mọi đoạn dài thêm ~14px nuốt hết khe hở).
  const C = 2 * Math.PI * 44;
  const segs = [
    { key: 'TRUSTED', frac: rtmCounts.TRUSTED / total, color: '#171717' },
    { key: 'STALE', frac: rtmCounts.STALE / total, color: '#a3a3a3' },
    { key: 'AT_RISK', frac: rtmCounts.AT_RISK / total, color: '#f59e0b' },
    { key: 'UNCOVERED', frac: rtmCounts.UNCOVERED / total, color: '#e5e5e5' },
  ].filter((s) => s.frac > 0);
  let arcOffset = 0;
  const arcs = segs.map((s) => {
    const arc = { ...s, dash: Math.max(s.frac * C - 2, 0), offset: arcOffset };
    arcOffset += s.frac * C;
    return arc;
  });

  return (
    <div className="space-y-4 tt-view-enter" id="sec-dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
          <p className="text-sm text-neutral-500 font-medium">{t(lang, 'dash', 'requirements')}</p>
          <p className="text-3xl font-bold mt-1">{reqs.length}</p>
          <p className="text-xs mt-1 text-neutral-400">
            {t(lang, 'dash', 'highRisk')}: <b className="text-neutral-900">{reqs.filter((r) => (r.score ?? 0) >= 15).length}</b>
          </p>
        </Card>
        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
          <p className="text-sm text-neutral-500 font-medium">{t(lang, 'dash', 'readyCases')}</p>
          <p className="text-3xl font-bold mt-1">
            {readyCases}
            <span className="text-base text-neutral-400 font-medium">/{cases.length}</span>
          </p>
          <div className="h-1.5 bg-neutral-100 rounded-full mt-2">
            <div
              className="h-full bg-neutral-950 rounded-full transition-all"
              style={{ width: `${cases.length ? Math.round((readyCases / cases.length) * 100) : 0}%` }}
            />
          </div>
        </Card>
        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
          <p className="text-sm text-neutral-500 font-medium">{t(lang, 'dash', 'passRate')}</p>
          <p className="text-3xl font-bold mt-1">{passRate === null ? '—' : `${passRate}%`}</p>
          <p className="text-xs mt-1 text-neutral-400">
            {trend.length > 0 ? t(lang, 'dash', 'lastRun') : t(lang, 'dash', 'noRun')}
          </p>
        </Card>
        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
          <p className="text-sm text-neutral-500 font-medium">{t(lang, 'dash', 'openDefects')}</p>
          <p className="text-3xl font-bold mt-1">{openDefects.length}</p>
          <p className="text-xs mt-1 text-neutral-400">
            {t(lang, 'dash', 'critical')}: <b className={critical > 0 ? 'text-rose-600' : 'text-neutral-900'}>{critical}</b>
          </p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {t(lang, 'dash', 'trend')}
            </CardTitle>
          </CardHeader>
          {trend.length === 0 ? (
            <p className="text-sm text-neutral-400">{t(lang, 'dash', 'noRun')}</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'rate') return [`${value}%`, t(lang, 'dash', 'passRateShort')];
                      return [value, name];
                    }}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', fontSize: 12 }}
                  />
                  <Bar dataKey="rate" fill="#171717" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(lang, 'dash', 'lastGate')}</CardTitle>
            {lastEval && verdictBadge(lastEval.eval.verdict)}
          </CardHeader>
          {lastEval ? (
            <>
              <p className="text-sm text-neutral-500 mb-3">{lastEval.gate}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400">
                    <th className="pb-2 font-semibold">{t(lang, 'dash', 'rule')}</th>
                    <th className="pb-2 font-semibold">{t(lang, 'dash', 'expected')}</th>
                    <th className="pb-2 font-semibold">{t(lang, 'dash', 'actual')}</th>
                    <th className="pb-2 font-semibold">{t(lang, 'dash', 'result')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {lastEval.eval.results.map((r) => (
                    <tr key={r.rule} className="hover:bg-neutral-50">
                      <td className="py-2.5 font-medium">{r.rule}</td>
                      <td className="text-neutral-500">{String(r.expected ?? '—')}</td>
                      <td className="font-semibold">{String(r.actual ?? '—')}</td>
                      <td>
                        {r.status === 'PASS' ? (
                          <Badge variant="success">PASS</Badge>
                        ) : r.status === 'FAIL' ? (
                          <Badge variant="danger">FAIL</Badge>
                        ) : (
                          <Badge variant="warning">{r.status}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-sm text-neutral-400">{t(lang, 'dash', 'noGateEval')}</p>
          )}
          <button type="button" onClick={() => onGoToTab('gates')} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-neutral-950 hover:underline cursor-pointer">
            {t(lang, 'dash', 'viewGate')} <ArrowRight className="w-4 h-4" />
          </button>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(lang, 'dash', 'rtmHealth')}</CardTitle>
          </CardHeader>
          <div className="flex items-center gap-4">
            <svg width="110" height="110" viewBox="0 0 110 110" className="[transform:rotate(-90deg)]">
              <circle cx="55" cy="55" r="44" fill="none" stroke="#f5f5f5" strokeWidth="14" />
              {arcs.map((s) => (
                <circle
                  key={s.key}
                  cx="55"
                  cy="55"
                  r="44"
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${s.dash} ${C}`}
                  strokeDashoffset={-s.offset}
                />
              ))}
            </svg>
            <ul className="text-sm space-y-1.5">
              {(Object.keys(rtmCounts) as Array<keyof typeof rtmCounts>).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  {rtmBadge(k, lang)} <b>{rtmCounts[k]}</b>
                </li>
              ))}
            </ul>
          </div>
          <button type="button" onClick={() => onGoToTab('rtm')} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-neutral-950 hover:underline cursor-pointer">
            {t(lang, 'dash', 'viewRtm')} <ArrowRight className="w-4 h-4" />
          </button>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {t(lang, 'dash', 'highRiskReqs')}
            </CardTitle>
          </CardHeader>
          {highRisk.length === 0 ? (
            <p className="text-sm text-neutral-400">{t(lang, 'dash', 'noData')}</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm">
              {highRisk.map((r) => {
                const row = rtm.find((x) => x.requirementId === r.id);
                return (
                  <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                    <span>
                      <b className="text-neutral-400">{r.code}</b> {r.title}
                      <Badge variant="default" className="ml-2">risk {r.score ?? 0}</Badge>
                    </span>
                    {row && rtmBadge(row.status, lang)}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t(lang, 'dash', 'recentActivity')}</CardTitle>
          </CardHeader>
          {audit.length === 0 ? (
            <p className="text-sm text-neutral-400">{t(lang, 'dash', 'noData')}</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm">
              {audit.map((e) => (
                <li key={e.id} className="py-2.5">
                  <span className="font-mono text-xs bg-neutral-100 rounded px-1.5 py-0.5 mr-2">{e.action}</span>
                  <span className="text-neutral-400 text-xs">
                    {new Date(e.createdAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {gates.length === 0 && reqs.length === 0 && (
        <p className="text-sm text-neutral-400 hidden">{t(lang, 'dash', 'noData')}</p>
      )}
    </div>
  );
}
