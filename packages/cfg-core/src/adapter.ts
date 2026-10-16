// Hợp đồng LanguageAdapter (nguồn: plan kiến trúc adapter + Q2 Slice 3).
// Adapter chuyển source thành NeutralCfg; chi tiết riêng nằm ở metadata.
import type { NeutralCfg, SourceRange } from './graph.js';

export interface CapabilityMatrix {
  sequence: boolean;
  branch: boolean;
  loop: boolean;
  earlyReturn: boolean;
  exceptionFlow: boolean;
  asyncGenerator: boolean;
  preprocessor: boolean;
}

export interface Diagnostic {
  line: number;
  column: number;
  message: string;
  kind: 'syntax-error' | 'unsupported';
}

export interface LanguageAdapter {
  id: string;
  versions: string[];
  buildControlFlow: (source: string) => NeutralCfg;
  locate: (graph: NeutralCfg, nodeId: string) => SourceRange | null;
  capabilities: () => CapabilityMatrix;
}

export interface AnalysisResult {
  graph?: NeutralCfg;
  diagnostics: Diagnostic[];
  partial?: string;
}
