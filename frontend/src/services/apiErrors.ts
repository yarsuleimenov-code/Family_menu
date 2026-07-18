export type ApiErrorCode = 'TIMEOUT' | 'NETWORK_ERROR' | 'LOCK_TIMEOUT' | 'PROTOCOL_ERROR' | string;

export class ApiTimeoutError extends Error {
  readonly code = 'TIMEOUT';
  readonly outcomeUnknown: boolean;

  constructor(message = 'Сервер не ответил вовремя', outcomeUnknown = false) {
    super(message);
    this.name = 'ApiTimeoutError';
    this.outcomeUnknown = outcomeUnknown;
  }
}

export class ApiNetworkError extends Error {
  readonly code = 'NETWORK_ERROR';
  readonly outcomeUnknown: boolean;

  constructor(message = 'Нет связи с сервером', outcomeUnknown = false) {
    super(message);
    this.name = 'ApiNetworkError';
    this.outcomeUnknown = outcomeUnknown;
  }
}

export class ApiResponseError extends Error {
  constructor(readonly code: ApiErrorCode, message: string, readonly retryable = false) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

export class ApiLockTimeoutError extends ApiResponseError {
  constructor(message = 'Данные сейчас обновляются другим пользователем') {
    super('LOCK_TIMEOUT', message, true);
    this.name = 'ApiLockTimeoutError';
  }
}

export class ApiProtocolError extends Error {
  readonly code = 'PROTOCOL_ERROR';

  constructor(message = 'Сервер вернул некорректный ответ') {
    super(message);
    this.name = 'ApiProtocolError';
  }
}

export function isUnknownMutationOutcome(error: unknown): boolean {
  return (error instanceof ApiTimeoutError || error instanceof ApiNetworkError) && error.outcomeUnknown;
}
