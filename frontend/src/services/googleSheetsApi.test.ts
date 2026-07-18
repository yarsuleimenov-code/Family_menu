import { afterEach, describe, expect, it, vi } from 'vitest';

async function apiModule() {
  vi.stubEnv('VITE_APPS_SCRIPT_ENDPOINT', 'https://example.invalid/exec');
  vi.resetModules();
  return import('./googleSheetsApi');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('Google Sheets API transport', () => {
  it('distinguishes timeout from network failure', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      (init?.signal as AbortSignal).addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const { callApi } = await apiModule();
    const pending = expect(callApi('saveCalendarPlan', {}, { requestId: 'id', timeoutMs: 10 }))
      .rejects.toMatchObject({ name: 'ApiTimeoutError', outcomeUnknown: true });
    await vi.advanceTimersByTimeAsync(10);
    await pending;
  });

  it('reports a network interruption with unknown mutation outcome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const { callApi } = await apiModule();
    await expect(callApi('updateSettings', {}, { requestId: 'id' })).rejects.toMatchObject({ name: 'ApiNetworkError', outcomeUnknown: true });
  });

  it('rejects malformed envelopes as protocol errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"unexpected":true}', { status: 200 })));
    const { callApi } = await apiModule();
    await expect(callApi('getAppData')).rejects.toMatchObject({ name: 'ApiProtocolError' });
  });

  it('rejects invalid JSON as a protocol error and keeps HTTP errors distinct', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{invalid', { status: 200 }))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const { callApi } = await apiModule();
    await expect(callApi('getAppData')).rejects.toMatchObject({ name: 'ApiProtocolError' });
    await expect(callApi('getAppData')).rejects.toMatchObject({ name: 'ApiResponseError', code: 'HTTP_503' });
  });

  it('keeps a server TIMEOUT envelope distinct from a client-side deadline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { code: 'TIMEOUT', message: 'server deadline' } }), { status: 200 })));
    const { callApi } = await apiModule();
    await expect(callApi('getAppData')).rejects.toMatchObject({ name: 'ApiResponseError', code: 'TIMEOUT' });
  });

  it('maps LOCK_TIMEOUT and API validation errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: { code: 'LOCK_TIMEOUT', message: 'busy', retryable: true } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'bad', retryable: false } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { callApi } = await apiModule();
    await expect(callApi('updateSettings', {}, { requestId: 'id' })).rejects.toMatchObject({ name: 'ApiLockTimeoutError' });
    await expect(callApi('updateSettings', {}, { requestId: 'id' })).rejects.toMatchObject({ name: 'ApiResponseError', code: 'VALIDATION_ERROR' });
  });

  it('does not report a caller abort as a server timeout', async () => {
    const caller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      (init?.signal as AbortSignal).addEventListener('abort', () => reject(new DOMException('caller abort', 'AbortError')));
    })));
    const { callApi } = await apiModule();
    const pending = expect(callApi('getAppData', undefined, { signal: caller.signal, timeoutMs: 1000 }))
      .rejects.toMatchObject({ name: 'AbortError' });
    caller.abort();
    await pending;
  });

  it('keeps caller abort classification stable even after the timeout deadline', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      (init?.signal as AbortSignal).addEventListener('abort', () => {
        globalThis.setTimeout(() => reject(new DOMException('caller abort', 'AbortError')), 20);
      });
    })));
    const { callApi } = await apiModule();
    const pending = expect(callApi('getAppData', undefined, { signal: caller.signal, timeoutMs: 10 }))
      .rejects.toMatchObject({ name: 'AbortError' });
    caller.abort();
    await vi.advanceTimersByTimeAsync(30);
    await pending;
  });
});
