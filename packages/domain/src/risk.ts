// Rủi ro: impact/likelihood 1–5, score là tích (nguồn: plan M02 + REQ-02).
export function riskScore(impact: number, likelihood: number): number {
  for (const value of [impact, likelihood]) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw Object.assign(new Error('Impact/likelihood phải trong thang 1–5'), {
        code: 'RISK_OUT_OF_RANGE',
      });
    }
  }
  return impact * likelihood;
}
