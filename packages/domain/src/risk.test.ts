// Rủi ro requirement: thang 1–5, score = impact × likelihood (nguồn: M02 + REQ-02).
import { describe, expect, it } from 'vitest';
import { riskScore } from './risk.js';

describe('riskScore', () => {
  it('tính score bằng tích impact × likelihood', () => {
    expect(riskScore(3, 4)).toBe(12);
    expect(riskScore(1, 1)).toBe(1);
    expect(riskScore(5, 5)).toBe(25);
  });

  it('ngoài thang 1–5 thì ném RISK_OUT_OF_RANGE', () => {
    for (const bad of [0, 6, -1]) {
      expect(() => riskScore(bad, 3)).toThrowError(
        expect.objectContaining({ code: 'RISK_OUT_OF_RANGE' }),
      );
      expect(() => riskScore(3, bad)).toThrowError(
        expect.objectContaining({ code: 'RISK_OUT_OF_RANGE' }),
      );
    }
  });
});
