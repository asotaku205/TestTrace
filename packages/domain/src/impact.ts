// ReasonCode impact dùng chung với RTM (nguồn: từ vựng Slice 5).
// PATH_CHANGED dành cho khi có dữ liệu coverage (chưa phát ở ticket này).
export type ImpactReasonCode = 'DIRECT_LINK' | 'PATH_CHANGED' | 'SAME_REQUIREMENT';

export interface UnitRef {
  artifactId: string;
  qualifiedName: string;
}

export function reasonCodesFor(
  testUnitRefs: UnitRef[],
  changedUnits: UnitRef[],
): ImpactReasonCode[] {
  const changedSet = new Set(changedUnits.map((u) => `${u.artifactId}::${u.qualifiedName}`));
  if (testUnitRefs.some((u) => changedSet.has(`${u.artifactId}::${u.qualifiedName}`))) {
    return ['DIRECT_LINK'];
  }
  const changedArtifacts = new Set(changedUnits.map((u) => u.artifactId));
  if (testUnitRefs.some((u) => changedArtifacts.has(u.artifactId))) {
    return ['SAME_REQUIREMENT'];
  }
  return [];
}
