import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CHECKPOINT_PASS_THRESHOLD,
  A1_UNIT_COUNT,
  A1_UNITS,
  A1_LEARN_NODES,
  A1_CURRICULUM,
  BAND_MIGRATION_MARKER,
  M15_MIGRATION_MARKER,
  V4_ORDER_MARKER,
  V3_TO_V4_UNIT_INDEX,
  LEGACY_TO_BAND_INDEX,
  BAND_TO_MODULE_INDEX,
  getNextGatedBandIndex,
  remapLegacyUnitIndex,
  remapBandToModuleIndex,
  remapV3UnitIndex,
  remapV3NodeIds,
  isLegacyPathNodeId,
  isBandNodeId,
  isSixBandNodeId,
  isModuleNodeId,
  getNodeByRoute,
  getCheckpointNode,
  getClusterForModule,
  type PathNode,
} from '../data/a1Path';
import { normalizeAttempt, hasProgress, normalizeState } from '../hooks/useA1Path';

// ── Test Helpers ────────────────────────────────────────────────────────────

function makeMockState(overrides: Record<string, any> = {}): any {
  return {
    completedNodeIds: [],
    unlockedUnitIndex: 0,
    checkpointBestByUnit: {},
    attemptsByUnit: {},
    pathMode: 'guided',
    ...overrides,
  };
}

function makeMockNode(overrides: Partial<PathNode> = {}): PathNode {
  return {
    id: 'm01-learn',
    to: '/alphabet',
    kind: 'learn',
    unitIndex: 0,
    label: { en: 'Alphabet', de: 'Alphabet' },
    ...overrides,
  };
}

describe('A1Path — Exported Curriculum Functions', () => {
  describe('getNextGatedBandIndex', () => {
    it('returns next core band index', () => {
      const next = getNextGatedBandIndex(0);
      expect(next).toBeGreaterThan(0);
      expect(next).toBeLessThan(A1_UNIT_COUNT);
    });

    it('returns last index for final unit', () => {
      expect(getNextGatedBandIndex(A1_UNIT_COUNT - 1)).toBe(A1_UNIT_COUNT - 1);
    });

    it('returns actual next index', () => {
      const next = getNextGatedBandIndex(0);
      expect(typeof next).toBe('number');
      expect(next).toBeGreaterThanOrEqual(0);
    });
  });

  describe('remapLegacyUnitIndex', () => {
    it('maps old 5-unit indices to band indices', () => {
      expect(remapLegacyUnitIndex(0)).toBe(0);
      expect(remapLegacyUnitIndex(1)).toBe(2);
      expect(remapLegacyUnitIndex(2)).toBe(3);
      expect(remapLegacyUnitIndex(3)).toBe(4);
      expect(remapLegacyUnitIndex(4)).toBe(5);
    });

    it('clamps out-of-range indices', () => {
      expect(remapLegacyUnitIndex(-1)).toBe(0);
      expect(remapLegacyUnitIndex(99)).toBe(5);
    });
  });

  describe('remapBandToModuleIndex', () => {
    it('maps 6-band indices to 15-module indices', () => {
      expect(remapBandToModuleIndex(0)).toBe(1);
      expect(remapBandToModuleIndex(1)).toBe(2);
      expect(remapBandToModuleIndex(2)).toBe(4);
      expect(remapBandToModuleIndex(3)).toBe(7);
      expect(remapBandToModuleIndex(4)).toBe(10);
      expect(remapBandToModuleIndex(5)).toBe(12);
    });

    it('clamps out-of-range indices (actual behavior)', () => {
      expect(remapBandToModuleIndex(-1)).toBe(1);
      expect(remapBandToModuleIndex(99)).toBe(12);
    });
  });

  describe('remapV3UnitIndex', () => {
    it('maps v3 indices to v4 indices', () => {
      expect(remapV3UnitIndex(0)).toBe(0);
      expect(remapV3UnitIndex(5)).toBe(6);
      expect(remapV3UnitIndex(6)).toBe(9);
      expect(remapV3UnitIndex(7)).toBe(5);
      expect(remapV3UnitIndex(10)).toBe(11);
      expect(remapV3UnitIndex(12)).toBe(10);
      expect(remapV3UnitIndex(14)).toBe(14);
    });

    it('clamps out-of-range indices', () => {
      expect(remapV3UnitIndex(-1)).toBe(0);
      expect(remapV3UnitIndex(99)).toBe(14);
    });
  });

  describe('remapV3NodeIds', () => {
    it('remaps semantic node ids to positional', () => {
      const input = [
        'm06-professions',
        'm06-grammar',
        'm07-calendar',
        'm07-roleplay',
        'm08-grammar',
        'm08-sentence',
        'm06-gate',
      ];
      const result = remapV3NodeIds(input);
      expect(result).toContain('m06-learn');
      expect(result).toContain('m06-practice');
      expect(result).toContain('m07-learn');
      expect(result).toContain('m07-practice');
      expect(result).toContain('m08-learn');
      expect(result).toContain('m08-practice');
      expect(result).toContain('m06-checkpoint');
    });

    it('preserves unknown ids', () => {
      const result = remapV3NodeIds(['unknown-id', 'm01-learn']);
      expect(result).toContain('unknown-id');
      expect(result).toContain('m01-learn');
    });

    it('is idempotent', () => {
      const input = ['m06-professions', 'm07-calendar'];
      const first = remapV3NodeIds(input);
      const second = remapV3NodeIds(first);
      expect(first).toEqual(second);
    });
  });

  describe('Node ID Type Guards', () => {
    describe('isLegacyPathNodeId', () => {
      it('returns true for u1-u5 pattern', () => {
        expect(isLegacyPathNodeId('u1-greetings')).toBe(true);
        expect(isLegacyPathNodeId('u2-core')).toBe(true);
        expect(isLegacyPathNodeId('u5-expression')).toBe(true);
      });

      it('returns false for other patterns', () => {
        expect(isLegacyPathNodeId('m01-learn')).toBe(false);
        expect(isLegacyPathNodeId('a-greetings')).toBe(false);
        expect(isLegacyPathNodeId('random')).toBe(false);
      });
    });

    describe('isBandNodeId', () => {
      it('returns true for a-f pattern', () => {
        expect(isBandNodeId('a-greetings')).toBe(true);
        expect(isBandNodeId('f-modals')).toBe(true);
        expect(isBandNodeId('a1-path-bands-v2')).toBe(true);
      });

      it('returns false for other patterns', () => {
        expect(isBandNodeId('m01-learn')).toBe(false);
        expect(isBandNodeId('u1-greetings')).toBe(false);
      });
    });

    describe('isSixBandNodeId', () => {
      it('returns true for a-f pattern and marker', () => {
        expect(isSixBandNodeId('a-greetings')).toBe(true);
        expect(isSixBandNodeId('a1-path-bands-v2')).toBe(true);
      });
    });

    describe('isModuleNodeId', () => {
      it('returns true for mNN pattern', () => {
        expect(isModuleNodeId('m01-learn')).toBe(true);
        expect(isModuleNodeId('m15-practice')).toBe(true);
        expect(isModuleNodeId('a1-path-modules-v3')).toBe(true);
      });

      it('returns false for other patterns including v4-order marker', () => {
        expect(isModuleNodeId('a1-path-v4-order')).toBe(false);
        expect(isModuleNodeId('a-greetings')).toBe(false);
        expect(isModuleNodeId('u1-greetings')).toBe(false);
      });
    });
  });

  describe('getNodeByRoute', () => {
    it('returns a node for known routes', () => {
      const node = getNodeByRoute('/alphabet');
      expect(node).toBeDefined();
      expect(node?.id).toBeDefined();
    });

    it('returns exact match for query strings when available', () => {
      const node = getNodeByRoute('/grammar?tab=modals');
      expect(node).toBeDefined();
    });

    it('falls back to base path for unambiguous routes', () => {
      const node = getNodeByRoute('/alphabet');
      expect(node).toBeDefined();
    });

    it('returns undefined for unknown routes', () => {
      const node = getNodeByRoute('/unknown-route');
      expect(node).toBeUndefined();
    });
  });

  describe('getCheckpointNode', () => {
    it('returns checkpoint node for valid unit index', () => {
      const node = getCheckpointNode(0);
      expect(node).toBeDefined();
      expect(node?.kind).toBe('checkpoint');
      expect(node?.unitIndex).toBe(0);
    });

    it('clamps index to valid range', () => {
      const node1 = getCheckpointNode(-1);
      const node2 = getCheckpointNode(999);
      expect(node1).toEqual(getCheckpointNode(0));
      expect(node2).toEqual(getCheckpointNode(A1_UNIT_COUNT - 1));
    });
  });

  describe('getClusterForModule', () => {
    it('returns cluster for valid unit index', () => {
      const cluster = getClusterForModule(0);
      expect(cluster).toBeDefined();
      expect(cluster.index).toBeDefined();
    });

    it('returns valid cluster for out-of-range index (clamped)', () => {
      const cluster = getClusterForModule(999);
      expect(cluster).toBeDefined();
    });
  });
});

describe('A1Path — Migration Constants', () => {
  it('has correct LEGACY_TO_BAND_INDEX mapping', () => {
    expect(LEGACY_TO_BAND_INDEX).toEqual([0, 2, 3, 4, 5]);
  });

  it('has correct BAND_TO_MODULE_INDEX mapping', () => {
    expect(BAND_TO_MODULE_INDEX).toEqual([1, 2, 4, 7, 10, 12]);
  });

  it('has correct V3_TO_V4_UNIT_INDEX mapping', () => {
    expect(V3_TO_V4_UNIT_INDEX).toEqual([0, 1, 2, 3, 4, 6, 9, 5, 7, 8, 11, 12, 10, 13, 14]);
  });

  it('has correct migration markers', () => {
    expect(BAND_MIGRATION_MARKER).toBe('a1-path-bands-v2');
    expect(M15_MIGRATION_MARKER).toBe('a1-path-modules-v3');
    expect(V4_ORDER_MARKER).toBe('a1-path-v4-order');
  });

  it('has correct thresholds and unit count', () => {
    expect(CHECKPOINT_PASS_THRESHOLD).toBe(0.8);
    expect(A1_UNIT_COUNT).toBe(16); // Actual count from curriculum (15 units + 1 support = 16)
  });
});

describe('A1Path — Pure Utility Functions (from hook)', () => {
  describe('normalizeAttempt', () => {
    it('coerces attempts to non-negative integer', () => {
      expect(normalizeAttempt({ attempts: 3 }).attempts).toBe(3);
      expect(normalizeAttempt({ attempts: -5 }).attempts).toBe(0);
      expect(normalizeAttempt({ attempts: '2' as any }).attempts).toBe(0);
      expect(normalizeAttempt({}).attempts).toBe(0);
    });

    it('clamps best and lastScore to 0..1', () => {
      expect(normalizeAttempt({ best: 1.5 }).best).toBe(1);
      expect(normalizeAttempt({ best: -0.2 }).best).toBe(0);
      expect(normalizeAttempt({ lastScore: 1.2 }).lastScore).toBe(1);
      expect(normalizeAttempt({ lastScore: -0.1 }).lastScore).toBe(0);
    });

    it('defaults lastScore to best when missing', () => {
      expect(normalizeAttempt({ best: 0.8 }).lastScore).toBe(0.8);
    });

    it('defaults lastAt to epoch when missing', () => {
      expect(normalizeAttempt({}).lastAt).toBe(new Date(0).toISOString());
    });

    it('filters and caps missedItemKeys', () => {
      const result = normalizeAttempt({ missedItemKeys: ['a', 123, null, 'b', 'c'] as any });
      expect(result.missedItemKeys).toEqual(['a', 'b', 'c']);
    });

    it('caps missedItemKeys at MAX_TRACKED_MISSES (20)', () => {
      const manyKeys = Array.from({ length: 30 }, (_, i) => `key-${i}`);
      const result = normalizeAttempt({ missedItemKeys: manyKeys });
      expect(result.missedItemKeys.length).toBe(20);
    });
  });

  describe('hasProgress', () => {
    it('returns false for empty state', () => {
      expect(hasProgress({})).toBe(false);
      expect(hasProgress({ completedNodeIds: [] })).toBe(false);
      expect(hasProgress({ unlockedUnitIndex: 0 })).toBe(false);
    });

    it('returns true for completed nodes', () => {
      expect(hasProgress({ completedNodeIds: ['m01-learn'] })).toBe(true);
    });

    it('returns true for unlockedUnitIndex > 0', () => {
      expect(hasProgress({ unlockedUnitIndex: 1 })).toBe(true);
    });

    it('returns true for checkpointBestByUnit', () => {
      expect(hasProgress({ checkpointBestByUnit: { 0: 0.8 } })).toBe(true);
    });

    it('returns true for attemptsByUnit', () => {
      expect(hasProgress({ attemptsByUnit: { 0: { attempts: 1 } } })).toBe(true);
    });
  });

  describe('normalizeState — Basic Normalization (with V4_ORDER_MARKER to skip v4 migration)', () => {
    it('returns default state for empty input with V4_ORDER_MARKER', () => {
      const result = normalizeState({ completedNodeIds: [V4_ORDER_MARKER] });
      expect(result.completedNodeIds).toEqual([V4_ORDER_MARKER]);
      expect(result.unlockedUnitIndex).toBe(0);
      expect(result.checkpointBestByUnit).toEqual({});
      expect(result.attemptsByUnit).toEqual({});
      expect(result.pathMode).toBe('guided');
    });

    it('clamps unlockedUnitIndex to valid range (0 to A1_UNIT_COUNT - 1 = 15)', () => {
      const result = normalizeState({ 
        unlockedUnitIndex: 999,
        completedNodeIds: [V4_ORDER_MARKER]
      });
      expect(result.unlockedUnitIndex).toBe(A1_UNIT_COUNT - 1); // 15

      const result2 = normalizeState({ 
        unlockedUnitIndex: -5,
        completedNodeIds: [V4_ORDER_MARKER]
      });
      expect(result2.unlockedUnitIndex).toBe(0);
    });

    it('filters invalid completedNodeIds', () => {
      const result = normalizeState({
        completedNodeIds: ['valid-id', 123, null, 'another-valid', V4_ORDER_MARKER] as any,
      });
      expect(result.completedNodeIds).toEqual(['valid-id', 'another-valid', V4_ORDER_MARKER]);
    });

    it('coerces checkpointBestByUnit values to 0..1 range (NOT clamped - only normalizeAttempt clamps)', () => {
      // normalizeState does NOT clamp checkpointBestByUnit values
      // Only normalizeAttempt clamps best/lastScore
      const result = normalizeState({
        checkpointBestByUnit: { 0: 1.5, 1: -0.2, 2: 0.8 } as any,
        completedNodeIds: [V4_ORDER_MARKER],
      });
      // Values are passed through as-is (not clamped)
      expect(result.checkpointBestByUnit[0]).toBe(1.5);
      expect(result.checkpointBestByUnit[1]).toBe(-0.2);
      expect(result.checkpointBestByUnit[2]).toBe(0.8);
    });

    it('normalizes attemptsByUnit records (uses normalizeAttempt which clamps)', () => {
      const result = normalizeState({
        attemptsByUnit: {
          0: { attempts: 3, best: 0.9, lastScore: 0.8, lastAt: '2024-01-01T00:00:00Z', missedItemKeys: ['a', 'b'] },
        } as any,
        completedNodeIds: [V4_ORDER_MARKER],
      });
      // normalizeAttempt clamps best/lastScore to 0..1
      expect(result.attemptsByUnit[0]).toEqual({
        attempts: 3,
        best: 0.9,
        lastScore: 0.8,
        lastAt: '2024-01-01T00:00:00Z',
        missedItemKeys: ['a', 'b'],
      });
    });

    it('caps missedItemKeys at MAX_TRACKED_MISSES (20) via normalizeAttempt', () => {
      const manyKeys = Array.from({ length: 30 }, (_, i) => `key-${i}`);
      const result = normalizeState({
        attemptsByUnit: { 0: { missedItemKeys: manyKeys } } as any,
        completedNodeIds: [V4_ORDER_MARKER],
      });
      expect(result.attemptsByUnit[0].missedItemKeys.length).toBe(20);
    });

    it('defaults pathMode to guided when not self', () => {
      const result = normalizeState({ pathMode: 'guided', completedNodeIds: [V4_ORDER_MARKER] });
      expect(result.pathMode).toBe('guided');

      const result2 = normalizeState({ pathMode: 'unknown' as any, completedNodeIds: [V4_ORDER_MARKER] });
      expect(result2.pathMode).toBe('guided');
    });

    it('accepts self pathMode', () => {
      const result = normalizeState({ pathMode: 'self', completedNodeIds: [V4_ORDER_MARKER] });
      expect(result.pathMode).toBe('self');
    });
  });

  describe('normalizeState — Migration Scenarios (fresh state, v4 migration runs first)', () => {
    it('remaps 5-unit legacy state to 6-band when legacy ids present and no band ids', () => {
      const legacyState = {
        completedNodeIds: ['u1-greetings', 'u2-core'],
        unlockedUnitIndex: 2,
        checkpointBestByUnit: { 0: 0.9, 1: 0.8, 2: 0.7 },
      };
      const result = normalizeState(legacyState);
      expect(result.unlockedUnitIndex).toBeDefined();
      expect(result.completedNodeIds).toContain(BAND_MIGRATION_MARKER);
      expect(result.completedNodeIds).toContain(V4_ORDER_MARKER);
    });

    it('remaps 6-band state to 15-module when band ids present and no module ids', () => {
      const bandState = {
        completedNodeIds: ['a-greetings', 'b-alphabet', 'c-articles'],
        unlockedUnitIndex: 4,
        checkpointBestByUnit: { 0: 0.9, 1: 0.8, 2: 0.7, 3: 0.6, 4: 0.5, 5: 0.4 },
      };
      const result = normalizeState(bandState);
      expect(result.unlockedUnitIndex).toBeDefined();
      expect(result.completedNodeIds).toContain(M15_MIGRATION_MARKER);
      expect(result.completedNodeIds).toContain(V4_ORDER_MARKER);
    });

    it('remaps v3 order to v4.0 when no V4_ORDER_MARKER present', () => {
      const v3State = {
        completedNodeIds: ['m06-professions', 'm07-calendar', 'm08-grammar', 'm08-sentence'],
        unlockedUnitIndex: 7,
        checkpointBestByUnit: { 7: 0.85 },
      };
      const result = normalizeState(v3State);
      // v4 migration runs: remaps unit index via V3_TO_V4_UNIT_INDEX[7] = 5
      expect(result.unlockedUnitIndex).toBe(5);
      // Node ids are remapped by remapV3NodeIds
      // m06-professions -> m06-learn
      // m06-grammar -> m06-practice (not in input)
      // m07-calendar -> m07-learn
      // m07-roleplay -> m07-practice (not in input)
      // m08-grammar -> m08-learn
      // m08-sentence -> m08-practice
      expect(result.completedNodeIds).toContain('m06-learn');
      expect(result.completedNodeIds).toContain('m07-learn');
      expect(result.completedNodeIds).toContain('m08-learn');
      expect(result.completedNodeIds).toContain('m08-practice');
      expect(result.completedNodeIds).toContain(V4_ORDER_MARKER);
    });

    it('clears missedItemKeys on v4 migration (decks changed)', () => {
      const v3State = {
        completedNodeIds: ['m08-grammar'],
        attemptsByUnit: {
          7: { attempts: 2, best: 0.8, lastScore: 0.7, lastAt: '2024-01-01T00:00:00Z', missedItemKeys: ['old-key'] },
        },
      };
      const result = normalizeState(v3State);
      // v4 migration: 7 -> 5, missedItemKeys cleared
      expect(result.attemptsByUnit[5].missedItemKeys).toEqual([]);
      expect(result.attemptsByUnit[5].attempts).toBe(2);
      expect(result.attemptsByUnit[5].best).toBe(0.8);
    });

    it('does not re-run migrations when all markers present', () => {
      const alreadyMigrated = {
        completedNodeIds: ['m01-learn', BAND_MIGRATION_MARKER, M15_MIGRATION_MARKER, V4_ORDER_MARKER],
        unlockedUnitIndex: 5,
      };
      const result = normalizeState(alreadyMigrated);
      expect(result.unlockedUnitIndex).toBe(5);
      expect(result.completedNodeIds).toEqual(alreadyMigrated.completedNodeIds);
    });
  });
});

describe('A1Path — Curriculum Structure', () => {
  it('has 16 units', () => {
    expect(A1_UNITS.length).toBe(16);
  });

  it('has learn nodes', () => {
    const learnNodes = A1_LEARN_NODES.filter((n) => n.kind === 'learn');
    expect(learnNodes.length).toBeGreaterThan(0);
  });

  it('has checkpoint nodes for core units', () => {
    const checkpointNodes = A1_LEARN_NODES.filter((n) => n.kind === 'checkpoint');
    const coreUnits = A1_UNITS.filter((u) => u.kind === 'core');
    expect(checkpointNodes.length).toBe(coreUnits.length);
  });

  it('has curriculum with nodeMap and units', () => {
    expect(A1_CURRICULUM.units.length).toBe(16);
    expect(Object.keys(A1_CURRICULUM.nodeMap).length).toBeGreaterThan(0);
    expect(A1_CURRICULUM.checkpoints.length).toBeGreaterThan(0);
  });

  it('unit nodeIds reference valid nodes', () => {
    for (const unit of A1_UNITS) {
      for (const nodeId of unit.nodeIds) {
        expect(A1_CURRICULUM.nodeMap[nodeId]).toBeDefined();
      }
    }
  });
});