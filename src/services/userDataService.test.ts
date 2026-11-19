import { beforeEach, expect, it, vi } from 'vitest';
import { V4_ORDER_MARKER } from '../data/a1Path';
import { userDataService } from './userDataService';

const { from, readRow, updateRow } = vi.hoisted(() => ({
  from: vi.fn(),
  readRow: vi.fn(),
  updateRow: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({ supabase: { from } }));

beforeEach(() => {
  readRow.mockReset();
  updateRow.mockReset();
  from.mockReset().mockImplementation(() => {
    const read = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: readRow,
    };
    return { select: () => read, update: updateRow };
  });
});

it('retries an A1 revision conflict using the latest progress from the other device', async () => {
  const base = {
    user_id: 'alice',
    path_mode: 'guided',
    unlocked_unit_index: 1,
    completed_node_ids: [V4_ORDER_MARKER, 'm01-greetings'],
    checkpoint_best_by_unit: { 0: 0.85 },
    updated_at: 'first-revision',
  };
  readRow
    .mockResolvedValueOnce({ data: base, error: null })
    .mockResolvedValueOnce({
      data: {
        ...base,
        unlocked_unit_index: 3,
        completed_node_ids: [...base.completed_node_ids, 'm03-alphabet'],
        checkpoint_best_by_unit: { 0: 0.85, 2: 0.95 },
        updated_at: 'next-revision',
      },
      error: null,
    });

  const matches = vi.fn().mockReturnThis();
  updateRow
    .mockReturnValueOnce({
      eq: matches,
      select: vi.fn().mockReturnThis(),
      maybeSingle: async () => ({ data: null, error: null }),
    })
    .mockReturnValueOnce({
      eq: matches,
      select: vi.fn().mockReturnThis(),
      maybeSingle: async () => ({ data: { user_id: 'alice' }, error: null }),
    });

  await userDataService.saveA1PathState('alice', {
    unlockedUnitIndex: 2,
    completedNodeIds: [V4_ORDER_MARKER, 'm02-numbers'],
    checkpointBestByUnit: { 0: 0.9, 1: 0.8 },
  });

  expect(matches).toHaveBeenCalledWith('updated_at', 'first-revision');
  expect(matches).toHaveBeenCalledWith('updated_at', 'next-revision');
  expect(updateRow).toHaveBeenLastCalledWith(expect.objectContaining({
    unlocked_unit_index: 3,
    completed_node_ids: expect.arrayContaining(['m01-greetings', 'm02-numbers', 'm03-alphabet']),
    checkpoint_best_by_unit: { 0: 0.9, 1: 0.8, 2: 0.95 },
  }));
});
