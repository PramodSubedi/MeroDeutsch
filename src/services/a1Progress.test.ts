import { expect, it } from 'vitest';
import { mergeA1Progress } from './a1Progress';

it('preserves progress and best scores from both devices', () => {
  const local = {
    unlockedUnitIndex: 2,
    completedNodeIds: ['m01-learn', 'm02-learn'],
    checkpointBestByUnit: { 0: 0.9, 1: 0.6 },
    pathMode: 'self' as const,
    attemptsByUnit: { 1: 2 },
  };

  const remote = {
    unlockedUnitIndex: 3,
    completedNodeIds: ['m01-learn', 'm03-learn'],
    checkpointBestByUnit: { 0: 0.8, 1: 0.85, 2: 0.5 },
    pathMode: 'guided' as const,
  };

  expect(mergeA1Progress(local, remote)).toEqual({
    unlockedUnitIndex: 3,
    completedNodeIds: ['m01-learn', 'm02-learn', 'm03-learn'],
    checkpointBestByUnit: { 0: 0.9, 1: 0.85, 2: 0.5 },
    pathMode: 'self',
    attemptsByUnit: { 1: 2 },
  });
});
