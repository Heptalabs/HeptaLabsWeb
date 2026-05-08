const LOG_BUFFER_KEY = 'imwallet.logs.v1';
const memoryLogStore = new Map<string, WalletLogEvent[]>();

type LogLevel = 'info' | 'warn' | 'error';

export type WalletLogEvent = {
  type: string;
  level?: LogLevel;
  payload?: Record<string, unknown>;
  at?: string;
};

const readLogs = (): WalletLogEvent[] => {
  return memoryLogStore.get(LOG_BUFFER_KEY) ?? [];
};

const writeLogs = (logs: WalletLogEvent[]) => {
  memoryLogStore.set(LOG_BUFFER_KEY, logs.slice(-300));
};

export const logEvent = (event: WalletLogEvent) => {
  const next: WalletLogEvent = {
    ...event,
    level: event.level ?? 'info',
    at: event.at ?? new Date().toISOString()
  };

  if (next.level === 'error') {
    // eslint-disable-next-line no-console
    console.error('[imwallet]', next.type, next.payload ?? {});
  } else if (next.level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn('[imwallet]', next.type, next.payload ?? {});
  } else {
    // eslint-disable-next-line no-console
    console.log('[imwallet]', next.type, next.payload ?? {});
  }

  const logs = readLogs();
  logs.push(next);
  writeLogs(logs);
};

export const getLogBuffer = () => readLogs();
