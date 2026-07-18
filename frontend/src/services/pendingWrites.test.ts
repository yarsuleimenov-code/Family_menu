import { describe, expect, it, vi } from 'vitest';
import { ApiLockTimeoutError, ApiNetworkError, ApiTimeoutError } from './apiErrors';
import {
  createPendingWrite, markWriteAttempt, markWriteFailure, markWriteSynced, normalizePendingWrites, PendingWriteGuard, runWithSingleLockRetry,
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

  it('prevents two UUIDs for the same logical operation from running in parallel', () => {
    const guard = new PendingWriteGuard();
    expect(guard.begin('id-1', 'same-date')).toBe(true);
    expect(guard.begin('id-2', 'same-date')).toBe(false);
    expect(guard.begin('id-2', 'other-date')).toBe(true);
    guard.end('id-1', 'same-date');
    expect(guard.begin('id-3', 'same-date')).toBe(true);
  });

  it('covers failure, unknown, lock and synced state transitions', () => {
    const now = new Date('2026-01-02');
    const write = createPendingWrite('updateSettings', {}, 'settings', new Date('2026-01-01'));
    expect(markWriteFailure(write, new Error('bad'), now).status).toBe('failed');
    expect(markWriteFailure(write, new ApiTimeoutError('', true), now).status).toBe('outcome_unknown');
    expect(markWriteFailure(write, new ApiLockTimeoutError(), now).status).toBe('retryable_lock');
    expect(markWriteSynced(write, now).status).toBe('synced');
  });

  it('migrates the legacy localStorage shape to a persisted UUID-ready schema', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'migrated-uuid' });
    const legacy = { id: 'updateSettings:{old}', statusKey: 'settings', action: 'updateSettings', payload: {}, createdAt: '2026-01-01T00:00:00.000Z' };
    const migrated = normalizePendingWrites([legacy], new Date('2026-01-02'));
    expect(migrated[0]).toMatchObject({ id: 'migrated-uuid', schemaVersion: 2, status: 'failed' });
    expect(normalizePendingWrites(JSON.parse(JSON.stringify(migrated)), new Date('2026-01-03'))[0].id).toBe('migrated-uuid');
    vi.unstubAllGlobals();
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
