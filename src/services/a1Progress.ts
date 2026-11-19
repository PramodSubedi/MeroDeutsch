import type { A1PathState } from './userDataService';

export function mergeA1Progress<T extends A1PathState>(local: T, remote: A1PathState): T {
  const checkpointBestByUnit = { ...local.checkpointBestByUnit };
  for (const [unit, score] of Object.entries(remote.checkpointBestByUnit)) {
    const index = Number(unit);
    checkpointBestByUnit[index] = Math.max(checkpointBestByUnit[index] ?? 0, score);
  }

  return {
    ...local,
    unlockedUnitIndex: Math.max(local.unlockedUnitIndex, remote.unlockedUnitIndex),
    completedNodeIds: [...new Set([...local.completedNodeIds, ...remote.completedNodeIds])].sort(),
    checkpointBestByUnit,
  };
}
