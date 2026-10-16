// Trích code units JS: tên + signature params (nguồn: REG-01).
// Signature không chứa thân hàm để version hóa đúng.
import { parse } from '@babel/parser';

export interface CodeUnitInfo {
  name: string;
  signature: string;
  params: string;
}

export function extractUnits(source: string): CodeUnitInfo[] {
  const file = parse(source, { plugins: ['typescript'], sourceType: 'module' });
  const units: CodeUnitInfo[] = [];
  for (const statement of file.program.body) {
    if (statement.type !== 'FunctionDeclaration' || !statement.id) continue;
    const params = statement.params
      .map((p) => {
        if (p.type === 'Identifier') return p.name;
        return p.type;
      })
      .join(',');
    units.push({
      name: statement.id.name,
      signature: `${statement.id.name}(${params})`,
      params,
    });
  }
  return units;
}
