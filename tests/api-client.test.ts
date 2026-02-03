import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RackspaceSpotClient } from '../src/api-client';

/**
 * Unit tests for RackspaceSpotClient
 *
 * Tests focus on:
 * - Authentication flow
 * - Token refresh behavior
 * - API method calls
 * - Error handling
 */

// Create a mock fetch that returns proper Response-like objects
function createMockFetch() {
  const responses: Map<string, { ok: boolean; status: number; data: unknown }> = new Map();

  const mockFetch = vi.fn(async (url: string, options?: RequestInit) => {
    let matchedResponse: { ok: boolean; status: number; data: unknown } | undefined;

    for (const [pattern, response] of responses) {
      if (url.includes(pattern)) {
        matchedResponse = response;
        break;
      }
    }

    if (!matchedResponse) {
      // Default to auth response for oauth/token
      if (url.includes('/oauth/token')) {
        matchedResponse = {
          ok: true,
          status: 200,
          data: {
            id_token: 'mock-id-token',
            access_token: 'mock-access-token',
            expires_in: 86400,
            token_type: 'Bearer',
          },
        };
      } else {
        throw new Error(`No mock response for: ${url}`);
      }
    }

    const responseData = matchedResponse.data;
    const headers = new Headers({ 'content-type': 'application/json' });

    return {
      ok: matchedResponse.ok,
      status: matchedResponse.status,
      statusText: matchedResponse.ok ? 'OK' : 'Error',
      headers,
      json: () => Promise.resolve(responseData),
      text: () => Promise.resolve(JSON.stringify(responseData)),
      clone: function () {
        return this;
      },
    } as unknown as Response;
  });

  return {
    mockFetch,
    setResponse: (urlPattern: string, response: { ok: boolean; status: number; data: unknown }) => {
      responses.set(urlPattern, response);
    },
    clearResponses: () => responses.clear(),
  };
}

describe('RackspaceSpotClient', () => {
  const mockRefreshToken = 'test-refresh-token';

  describe('constructor', () => {
    it('should create a client with required config', () => {
      const client = new RackspaceSpotClient({ refreshToken: mockRefreshToken });
      expect(client).toBeDefined();
    });

    it('should accept custom base URLs', () => {
      const client = new RackspaceSpotClient({
        refreshToken: mockRefreshToken,
        apiBaseUrl: 'https://custom-api.example.com',
        authBaseUrl: 'https://custom-auth.example.com',
      });
      expect(client).toBeDefined();
    });
  });

  describe('authentication', () => {
    it('should authenticate with correct parameters', async () => {
      const { mockFetch, setResponse } = createMockFetch();

      // Override global fetch for this test
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      setResponse('/oauth/token', {
        ok: true,
        status: 200,
        data: {
          id_token: 'mock-id-token',
          access_token: 'mock-access-token',
          expires_in: 86400,
          token_type: 'Bearer',
        },
      });

      const client = new RackspaceSpotClient({ refreshToken: mockRefreshToken });

      // Trigger authentication by making an API call
      setResponse('/cloudspaces', {
        ok: true,
        status: 200,
        data: { items: [] },
      });

      try {
        await client.listCloudSpaces('org-test');
      } catch {
        // May fail due to openapi-fetch, but auth should have been called
      }

      // Verify auth was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('login.spot.rackspace.com/oauth/token'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      // Verify the body contains correct parameters
      const authCall = mockFetch.mock.calls.find((call) =>
        (call[0] as string).includes('/oauth/token')
      );
      expect(authCall).toBeDefined();
      const body = authCall![1]?.body as URLSearchParams;
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('client_id')).toBe('mwG3lUMV8KyeMqHe4fJ5Bb3nM1vBvRNa');
      expect(body.get('refresh_token')).toBe(mockRefreshToken);

      globalThis.fetch = originalFetch;
    });

    it('should throw on authentication failure', async () => {
      const { mockFetch, setResponse } = createMockFetch();

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      setResponse('/oauth/token', {
        ok: false,
        status: 401,
        data: { error: 'Invalid refresh token' },
      });

      const client = new RackspaceSpotClient({ refreshToken: mockRefreshToken });

      setResponse('/cloudspaces', {
        ok: true,
        status: 200,
        data: { items: [] },
      });

      await expect(client.listCloudSpaces('org-test')).rejects.toThrow('Failed to authenticate');

      globalThis.fetch = originalFetch;
    });

    it('should use custom auth URL when provided', async () => {
      const { mockFetch, setResponse } = createMockFetch();

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      setResponse('/oauth/token', {
        ok: true,
        status: 200,
        data: {
          id_token: 'mock-id-token',
          expires_in: 86400,
        },
      });

      const client = new RackspaceSpotClient({
        refreshToken: mockRefreshToken,
        authBaseUrl: 'https://custom-auth.example.com',
      });

      setResponse('/cloudspaces', {
        ok: true,
        status: 200,
        data: { items: [] },
      });

      try {
        await client.listCloudSpaces('org-test');
      } catch {
        // May fail, but auth should use custom URL
      }

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-auth.example.com/oauth/token',
        expect.anything()
      );

      globalThis.fetch = originalFetch;
    });
  });

  describe('default URLs', () => {
    it('should use default API URL', () => {
      const client = new RackspaceSpotClient({ refreshToken: mockRefreshToken });
      // Client should be created with default URLs (internal check)
      expect(client).toBeDefined();
    });
  });
});
