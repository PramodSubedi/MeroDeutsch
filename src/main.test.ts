import { expect, it, vi } from 'vitest';
import clusters from './data/curriculum/clusters.json';
import { UNIT_FILES } from './data/curriculum/units.generated';
import { CURRICULUM_SCHEMA_VERSION } from './data/curriculum/schema';

const { mount } = vi.hoisted(() => ({ mount: vi.fn() }));

vi.mock('./lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_column: string, key: string) => ({
          maybeSingle: async () => ({
            error: null,
            data: { value: key === 'curriculum_source' ? 'db' : {
              schemaVersion: CURRICULUM_SCHEMA_VERSION,
              clusters,
              units: UNIT_FILES.map((unit, index) => index === 0
                ? { ...unit, title: { ...unit.title, en: 'Published A1 title' } }
                : unit),
            } },
          }),
        }),
      }),
    }),
  },
}));
vi.mock('./mountLearner', async () => {
  const { A1_UNITS } = await import('./data/a1Path');
  return { mountLearner: () => mount(A1_UNITS[0]?.title.en) };
});

it('initializes the learner curriculum from the published document', async () => {
  document.body.innerHTML = '<div id="root"></div><div id="app-splash"></div>';
  await import('./main');
  await vi.waitFor(() => expect(mount).toHaveBeenCalledWith('Published A1 title'));
  expect(document.getElementById('app-splash')).toBeNull();
});
