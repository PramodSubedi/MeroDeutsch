import { expect, it, vi } from 'vitest';
import { entitlementService } from './entitlementService';

const { maybeSingle } = vi.hoisted(() => ({ maybeSingle: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  },
}));

it('coalesces simultaneous reads for one learner and allows a later refresh', async () => {
  maybeSingle
    .mockResolvedValueOnce({ data: { plan: 'premium' }, error: null })
    .mockResolvedValueOnce({ data: { plan: 'free' }, error: null });

  const results = await Promise.all([
    entitlementService.readPlan('learner'),
    entitlementService.readPlan('learner'),
  ]);
  expect(results.map((result) => result.plan)).toEqual(['premium', 'premium']);
  expect(maybeSingle).toHaveBeenCalledTimes(1);
  expect((await entitlementService.readPlan('learner')).plan).toBe('free');
  expect(maybeSingle).toHaveBeenCalledTimes(2);
});
