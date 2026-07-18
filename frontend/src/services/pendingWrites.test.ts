import { describe, expect, it, vi } from 'vitest';
import { ApiLockTimeoutError, ApiNetworkError, ApiTimeoutError } from './apiErrors';
import {
  createPendingWrite, markWriteAttempt, normalizePendingWrites, PendingWriteGuard, runWithSingleLockRetry,
} from './pendingWrites';

describe('pending writes', () => {
  it('keeps one UUID across attempts', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'stable-id' });
    const write = createPendingWrite('updateSettings', {}, 'settings', new Date('2026-01-01'));
    expect(markWriteAttempt(markWriteAttempt(write)).id).toBe('stable-id');
    vi.unstubAllGlobals();
  });

  it('marks writes older than 30 days as expired without deleting them', () => {
    const write = createPendingWrite('updateSettings', {}, 'settings', new Date('2026-01-01'));
    const normalized = normalizePendingWrites([write], new Date('2026-02-01'));
    expect(normalized).toHaveLength(1);
    expect(normalized[0].status).toBe('expired');
  });

  it('prevents parallel sends for the same write', () => {
    const guard = new PendingWriteGuard();
    expect(guard.begin('id')).toBe(true);
    expect(guard.begin('id')).toBe(false);
    guard.end('id');
    expect(guard.begin('id')).toBe(true);
  });

  it('retries LOCK_TIMEOUT exactly once with jitter', async () => {
    const send = vi.fn().mockRejectedValueOnce(new ApiLockTimeoutError()).mockResolvedValue('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(runWithSingleLockRetry(send, undefined, sleep, () => 0.5)).resolves.toBe('ok');
    expect(send).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it.each([new ApiTimeoutError('', true), new ApiNetworkError('', true)])('does not retry an unknown outcome', async (error) => {
    const send = vi.fn().mockRejectedValue(error);
    await expect(runWithSingleLockRetry(send, undefined, vi.fn())).rejects.toBe(error);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
