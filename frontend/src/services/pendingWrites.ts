import { ApiLockTimeoutError, ApiNetworkError, ApiResponseError, ApiTimeoutError, isUnknownMutationOutcome } from './apiErrors';

export type WriteAction =
  | 'saveSelectedDinner' | 'saveCalendarPlan' | 'saveShoppingSession'
  | 'createDish' | 'updateDish' | 'deactivateDish'
  | 'createBaseProduct' | 'updateBaseProduct' | 'deactivateBaseProduct' | 'updateSettings';

export type PendingWriteStatus = 'in_flight' | 'failed' | 'outcome_unknown' | 'retryable_lock' | 'synced' | 'expired';

export interface PendingWrite {
  id: string;
  statusKey: string;
  action: WriteAction;
  payload: unknown;
  status: PendingWriteStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  attemptCount: number;
  lockRetryCount: number;
  errorCode?: string;
  error?: string;
}

export const PENDING_WRITE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function createPendingWrite(action: WriteAction, payload: unknown, statusKey: string, now = new Date()): PendingWrite {
  return {
    id: crypto.randomUUID(),
    statusKey,
    action,
    payload,
    status: 'in_flight',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PENDING_WRITE_MAX_AGE_MS).toISOString(),
    attemptCount: 0,
    lockRetryCount: 0,
  };
}

export function normalizePendingWrites(value: unknown, now = new Date()): PendingWrite[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isLegacyPendingWrite).map((raw) => {
    const createdAt = raw.createdAt || now.toISOString();
    const expiresAt = raw.expiresAt || new Date(new Date(createdAt).getTime() + PENDING_WRITE_MAX_AGE_MS).toISOString();
    const status = raw.status || 'failed';
    return {
      ...raw,
      status: new Date(expiresAt).getTime() <= now.getTime() ? 'expired' : status === 'in_flight' ? 'failed' : status,
      createdAt,
      updatedAt: raw.updatedAt || createdAt,
      expiresAt,
      attemptCount: raw.attemptCount || 0,
      lockRetryCount: raw.lockRetryCount || 0,
    } as PendingWrite;
  });
}

export function markWriteAttempt(write: PendingWrite, now = new Date()): PendingWrite {
  return { ...write, status: 'in_flight', updatedAt: now.toISOString(), attemptCount: write.attemptCount + 1, error: undefined, errorCode: undefined };
}

export function markWriteFailure(write: PendingWrite, error: unknown, now = new Date()): PendingWrite {
  if (new Date(write.expiresAt).getTime() <= now.getTime()) return { ...write, status: 'expired', updatedAt: now.toISOString() };
  if (isUnknownMutationOutcome(error)) {
    return { ...write, status: 'outcome_unknown', updatedAt: now.toISOString(), errorCode: error instanceof ApiTimeoutError ? 'TIMEOUT' : 'NETWORK_ERROR', error: error instanceof Error ? error.message : undefined };
  }
  if (error instanceof ApiLockTimeoutError) {
    return { ...write, status: 'retryable_lock', updatedAt: now.toISOString(), errorCode: error.code, error: error.message };
  }
  const errorCode = error instanceof ApiResponseError || error instanceof ApiNetworkError ? error.code : 'FAILED';
  return { ...write, status: 'failed', updatedAt: now.toISOString(), errorCode, error: error instanceof Error ? error.message : 'Не удалось сохранить' };
}

export function lockRetryDelay(random = Math.random): number {
  return 500 + Math.floor(random() * 1001);
}

export async function runWithSingleLockRetry<T>(
  send: () => Promise<T>,
  onRetry: (error: ApiLockTimeoutError) => void = () => undefined,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms)),
  random = Math.random,
): Promise<T> {
  try {
    return await send();
  } catch (error) {
    if (!(error instanceof ApiLockTimeoutError)) throw error;
    onRetry(error);
    await sleep(lockRetryDelay(random));
    return send();
  }
}

export class PendingWriteGuard {
  private readonly active = new Set<string>();

  begin(id: string): boolean {
    if (this.active.has(id)) return false;
    this.active.add(id);
    return true;
  }

  end(id: string): void {
    this.active.delete(id);
  }

  isActive(id: string): boolean {
    return this.active.has(id);
  }
}

function isLegacyPendingWrite(value: unknown): value is Partial<PendingWrite> & Pick<PendingWrite, 'id' | 'action' | 'statusKey' | 'payload'> {
  if (!value || typeof value !== 'object') return false;
  const write = value as Partial<PendingWrite>;
  return typeof write.id === 'string' && typeof write.action === 'string' && typeof write.statusKey === 'string'
    && ('payload' in write);
}
