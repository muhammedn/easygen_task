import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { AxiosError, AxiosHeaders } from 'axios';
import api from '@/lib/api';
import { emitUnauthorized } from '@/lib/auth-events';

vi.mock('@/lib/auth-events', () => ({
  emitUnauthorized: vi.fn(),
  onUnauthorized: vi.fn(() => () => undefined),
}));

function unauthorized(
  config: InternalAxiosRequestConfig,
): never {
  throw new AxiosError(
    'Unauthorized',
    'ERR_BAD_REQUEST',
    config,
    {},
    {
      data: { message: 'Unauthorized' },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
    },
  );
}

describe('api interceptor refresh', () => {
  let originalAdapter: AxiosAdapter | undefined;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter as AxiosAdapter | undefined;
    vi.mocked(emitUnauthorized).mockClear();
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('retries the original request after a successful refresh', async () => {
    let meCalls = 0;
    let refreshCalls = 0;

    api.defaults.adapter = async (config) => {
      const url = config.url ?? '';
      const headers = AxiosHeaders.from(config.headers);

      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return {
          data: { user: { id: '1', email: 'a@b.c', name: 'A' } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { ...config, headers },
        };
      }

      if (url.includes('/auth/me')) {
        meCalls += 1;
        if (meCalls === 1) {
          unauthorized(config);
        }
        return {
          data: { user: { id: '1', email: 'a@b.c', name: 'A' } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { ...config, headers },
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    };

    const result = await api.get('/auth/me');

    expect(result.status).toBe(200);
    expect(meCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(emitUnauthorized).not.toHaveBeenCalled();
  });

  it('emits unauthorized when refresh fails', async () => {
    api.defaults.adapter = async (config) => {
      unauthorized(config);
    };

    await expect(api.get('/auth/me')).rejects.toBeTruthy();
    expect(emitUnauthorized).toHaveBeenCalled();
  });
});
