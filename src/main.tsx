import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { setUpdateAvailable } from './hooks/useUpdatePrompt';

/**
 * Service-worker registration — MAIN APP ONLY.
 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => setUpdateAvailable(() => updateSW(true)),
});

function clearBootSplash(): void {
  document.getElementById('app-splash')?.remove();
}

async function boot() {
  let source = 'bundle';
  try {
    const gate = await import('./data/curriculum/bootGate');
    const outcome = await gate.runBootGate({
      readFlag: () => import('./data/curriculum/flagReader').then((m) => m.readCurriculumSourceFlag()),
      fetchDoc: () => import('./data/curriculum/flagReader').then((m) => m.fetchDbCurriculum()),
      countUnits: (raw) => (Array.isArray((raw as { units?: unknown[] }).units) ? (raw as { units: unknown[] }).units.length : 0),
    });
    source = outcome.kind === 'db' ? `db (${outcome.units} units)` : `bundle (${outcome.reason})`;
  } catch (err) {
    source = `bundle (gate failed: ${err instanceof Error ? err.message : String(err)})`;
  }

  if (import.meta.env.DEV) console.info(`[curriculum] serving ${source}`);

  // The mounted app and its providers read the active curriculum at module load.
  let mountLearner: typeof import('./mountLearner').mountLearner;
  try {
    ({ mountLearner } = await import('./mountLearner'));
  } catch (err) {
    const root = document.getElementById('root');
    if (root) {
      clearBootSplash();
      root.textContent = 'The app could not be loaded. Check your connection and reload.';
      console.error('[boot] App chunk failed to load', err);
    }
    return;
  }

  clearBootSplash();
  mountLearner();
}

void boot();
