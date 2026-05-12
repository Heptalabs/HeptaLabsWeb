const LOG_BUFFER_KEY = 'imwallet.logs.v1';
const memoryLogStore = new Map<string, WalletLogEvent[]>();
const MAX_LOG_STRING_LENGTH = 180;
const MAX_LOG_DEPTH = 3;
const REDACTED_VALUE = '[REDACTED]';
const SAFE_PAYLOAD_KEYS = new Set([
  'chain',
  'symbol',
  'network',
  'status',
  'reason',
  'code',
  'platform',
  'screen',
  'route',
  'wordCount',
  'valueLength',
  'tokenId',
  'txId',
  'hash',
  'nonce',
  'gasLimit',
  'asset',
  'category',
  'section',
  'itemId',
  'resolvedActionType',
  'declaredActionType',
  'authMethod',
  'durationMs',
  'count'
]);
const SENSITIVE_KEY_PATTERN = /seed|mnemonic|private|secret|password|passphrase|token|wallet|address|auth|key/i;

type LogLevel = 'info' | 'warn' | 'error';

export type WalletLogEvent = {
  type: string;
  level?: LogLevel;
  payload?: Record<string, unknown>;
  at?: string;
};

const sanitizePrimitive = (value: unknown) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length <= MAX_LOG_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_LOG_STRING_LENGTH)}...`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
};

const sanitizePayloadValue = (value: unknown, depth: number): unknown => {
  if (depth >= MAX_LOG_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizePayloadValue(entry, depth + 1));
  }
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    Object.entries(input).forEach(([key, entry]) => {
      if (!SAFE_PAYLOAD_KEYS.has(key) || SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = REDACTED_VALUE;
        return;
      }
      out[key] = sanitizePayloadValue(entry, depth + 1);
    });
    return out;
  }
  return sanitizePrimitive(value);
};

const sanitizePayload = (payload?: Record<string, unknown>) => {
  if (!payload || typeof payload !== 'object') return {};
  return sanitizePayloadValue(payload, 0) as Record<string, unknown>;
};

const readLogs = (): WalletLogEvent[] => {
  return memoryLogStore.get(LOG_BUFFER_KEY) ?? [];
};

const writeLogs = (logs: WalletLogEvent[]) => {
  memoryLogStore.set(LOG_BUFFER_KEY, logs.slice(-300));
};

export const logEvent = (event: WalletLogEvent) => {
  const safePayload = sanitizePayload(event.payload);
  const next: WalletLogEvent = {
    ...event,
    level: event.level ?? 'info',
    payload: safePayload,
    at: event.at ?? new Date().toISOString()
  };

  if (next.level === 'error') {
    // eslint-disable-next-line no-console
    console.error('[imwallet]', next.type, safePayload);
  } else if (next.level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn('[imwallet]', next.type, safePayload);
  } else {
    // eslint-disable-next-line no-console
    console.log('[imwallet]', next.type, safePayload);
  }

  const logs = readLogs();
  logs.push(next);
  writeLogs(logs);
};

export const getLogBuffer = () => readLogs();
