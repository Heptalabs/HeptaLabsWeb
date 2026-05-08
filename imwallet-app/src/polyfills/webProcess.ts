if (typeof document !== 'undefined') {
  const scope = globalThis as typeof globalThis & {
    process?: {
      version?: string;
      browser?: boolean;
      [key: string]: unknown;
    };
  };

  const proc = scope.process ?? {};

  if (typeof proc.version !== 'string' || proc.version.length === 0) {
    proc.version = 'v18.0.0';
  }

  if (typeof proc.browser !== 'boolean') {
    proc.browser = true;
  }

  scope.process = proc;
}
