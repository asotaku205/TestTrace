// Trích code units Python: tên + signature args (nguồn: REG-01).
import { parsePythonSync, type PythonNode } from './bridge.js';

export interface CodeUnitInfo {
  name: string;
  signature: string;
  params: string;
}

function argName(arg: PythonNode): string {
  return typeof arg.arg === 'string' ? arg.arg : 'arg';
}

export function extractUnits(source: string): CodeUnitInfo[] {
  const tree = parsePythonSync(source);
  const units: CodeUnitInfo[] = [];
  for (const node of tree.body) {
    if (node._type !== 'FunctionDef' || typeof node.name !== 'string') continue;
    const args = node.args as PythonNode | undefined;
    const positional = (args?.args as PythonNode[] | undefined) ?? [];
    const params = positional.map(argName).join(',');
    units.push({ name: node.name, signature: `${node.name}(${params})`, params });
  }
  return units;
}
