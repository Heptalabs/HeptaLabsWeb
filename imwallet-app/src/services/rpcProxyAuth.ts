const RPC_PROXY_API_KEY = String(process.env.EXPO_PUBLIC_RPC_PROXY_API_KEY || '').trim();

const toHeaderRecord = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [String(key), String(value)]));
  }
  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    acc[key] = String(value);
    return acc;
  }, {});
};

export const withRpcProxyAuthHeaders = (headers?: HeadersInit): HeadersInit => {
  const merged = toHeaderRecord(headers);
  if (RPC_PROXY_API_KEY) {
    merged['x-rpc-proxy-key'] = RPC_PROXY_API_KEY;
  }
  return merged;
};
