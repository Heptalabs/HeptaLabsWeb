import { logEvent } from './logger';

export const trackPerformance = (name: string, startedAt: number, extra?: Record<string, unknown>) => {
  const durationMs = Date.now() - startedAt;
  logEvent({
    type: 'performance.metric',
    payload: {
      name,
      durationMs,
      ...extra
    }
  });
};

export const trackError = (name: string, error: unknown, extra?: Record<string, unknown>) => {
  logEvent({
    type: 'runtime.error',
    level: 'error',
    payload: {
      name,
      message: error instanceof Error ? error.message : String(error),
      ...extra
    }
  });
};
