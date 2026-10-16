// Ghép code units 2 version (nguồn: DIFF-01).
// same: cùng tên. moved: khác tên cùng params (đổi tên, không phải modified).
// removed/added: còn lại.
export interface UnitRef {
  qualifiedName: string;
  paramsHash: string;
}

export type UnitMatchStatus = 'same' | 'moved' | 'added' | 'removed';

export interface UnitMatch {
  status: UnitMatchStatus;
  oldName: string | null;
  newName: string | null;
}

export function matchUnits(oldUnits: UnitRef[], newUnits: UnitRef[]): UnitMatch[] {
  const matches: UnitMatch[] = [];
  const oldByName = new Map(oldUnits.map((u) => [u.qualifiedName, u]));
  const newByName = new Map(newUnits.map((u) => [u.qualifiedName, u]));
  const unmatchedOld = oldUnits.filter((u) => !newByName.has(u.qualifiedName));
  const unmatchedNew = newUnits.filter((u) => !oldByName.has(u.qualifiedName));
  for (const old of oldUnits) {
    if (newByName.has(old.qualifiedName)) {
      matches.push({ status: 'same', oldName: old.qualifiedName, newName: old.qualifiedName });
    }
  }
  const usedNew = new Set<string>();
  for (const old of unmatchedOld) {
    const renamed = unmatchedNew.find(
      (n) => !usedNew.has(n.qualifiedName) && n.paramsHash === old.paramsHash,
    );
    if (renamed) {
      usedNew.add(renamed.qualifiedName);
      matches.push({ status: 'moved', oldName: old.qualifiedName, newName: renamed.qualifiedName });
    } else {
      matches.push({ status: 'removed', oldName: old.qualifiedName, newName: null });
    }
  }
  for (const current of unmatchedNew) {
    if (!usedNew.has(current.qualifiedName)) {
      matches.push({ status: 'added', oldName: null, newName: current.qualifiedName });
    }
  }
  return matches;
}
