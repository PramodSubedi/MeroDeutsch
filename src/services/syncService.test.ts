import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSync, queueAchievementUnlock } from './syncService';

const { unlockAchievement } = vi.hoisted(() => ({ unlockAchievement: vi.fn() }));

vi.mock('./userDataService', () => ({ userDataService: { unlockAchievement } }));
vi.mock('../lib/db', () => ({ openDb: () => null }));

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.mocked(localStorage.getItem).mockImplementation((key) => storage.get(key) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
    storage.set(key, value);
  });
  unlockAchievement.mockReset().mockResolvedValue(undefined);
});

describe('offline achievement replay', () => {
  it('retries failed entries and acknowledges successful entries', async () => {
    queueAchievementUnlock('alice', 'first-steps');
    queueAchievementUnlock('alice', 'steady');
    unlockAchievement.mockRejectedValueOnce(new Error('offline'));

    expect(await executeSync('alice')).toEqual(['achievement:offline']);
    expect(await executeSync('alice')).toEqual([]);
    expect(await executeSync('alice')).toEqual([]);

    expect(unlockAchievement.mock.calls).toEqual([
      ['alice', 'first-steps'],
      ['alice', 'steady'],
      ['alice', 'first-steps'],
    ]);
  });

  it('retains entries for other accounts and entries added during a flush', async () => {
    queueAchievementUnlock('alice', 'first-steps');
    queueAchievementUnlock('bob', 'steady');
    unlockAchievement.mockImplementationOnce(async () => {
      queueAchievementUnlock('alice', 'new-badge');
    });

    await executeSync('alice');
    await executeSync('bob');
    await executeSync('alice');

    expect(unlockAchievement.mock.calls).toEqual([
      ['alice', 'first-steps'],
      ['bob', 'steady'],
      ['alice', 'new-badge'],
    ]);
  });

  it('replays entries persisted by older versions', async () => {
    localStorage.setItem('meroDeutschSyncQueue', JSON.stringify([
      { userId: 'alice', kind: 'achievement', payload: 'legacy-badge', at: '2026-01-01' },
    ]));
    await executeSync('alice');
    expect(unlockAchievement).toHaveBeenCalledExactlyOnceWith('alice', 'legacy-badge');
  });
});
