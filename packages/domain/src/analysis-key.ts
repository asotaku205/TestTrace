// Hash ổn định cho khóa idempotency (nguồn: plan M10 + ANALYSIS-01).
import { createHash } from 'node:crypto';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function stableHash(config: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sortKeys(config)))
    .digest('hex');
}
