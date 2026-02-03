import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './api-types';

// Default URLs matching rackspace-spot-mcp patterns
const DEFAULT_API_BASE_URL = 'https://spot.rackspace.com';
const DEFAULT_AUTH_BASE_URL = 'https://login.spot.rackspace.com';
const PUBLIC_CLIENT_ID = 'mwG3lUMV8KyeMqHe4fJ5Bb3nM1vBvRNa';

export interface RackspaceSpotConfig {
  refreshToken: string;
  apiBaseUrl?: string;
  authBaseUrl?: string;
}

interface OAuthTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export class RackspaceSpotClient {
  private refreshToken: string;
  private apiBaseUrl: string;
  private authBaseUrl: string;
  private client: ReturnType<typeof createClient<paths>>;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: RackspaceSpotConfig) {
    this.refreshToken = config.refreshToken;
    this.apiBaseUrl = config.apiBaseUrl || DEFAULT_API_BASE_URL;
    this.authBaseUrl = config.authBaseUrl || DEFAULT_AUTH_BASE_URL;

    // Create the openapi-fetch client
    this.client = createClient<paths>({ baseUrl: this.apiBaseUrl });

    // Add authentication middleware
    const authMiddleware: Middleware = {
      onRequest: async ({ request }) => {
        await this.ensureAuthenticated();
        if (this.accessToken) {
          request.headers.set('Authorization', `Bearer ${this.accessToken}`);
        }
        return request;
      },
    };

    this.client.use(authMiddleware);
  }

  private async ensureAuthenticated(): Promise<void> {
    // Refresh token 60 seconds before expiry to avoid race conditions
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return;
    }
    await this.authenticate();
  }

  private async authenticate(): Promise<void> {
    const response = await fetch(`${this.authBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: PUBLIC_CLIENT_ID,
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to authenticate: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as OAuthTokenResponse;
    // Use id_token as the bearer token (per rackspace-spot-mcp pattern)
    this.accessToken = data.id_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
  }

  async listCloudSpaces(namespace: string) {
    const { data, error } = await this.client.GET('/apis/ngpc.rxt.io/v1/namespaces/{namespace}/cloudspaces', {
      params: { path: { namespace } },
    });

    if (error) {
      throw new Error(`Failed to list cloudspaces: ${JSON.stringify(error)}`);
    }

    return data;
  }

  async listSpotNodePools(namespace: string) {
    const { data, error } = await this.client.GET('/apis/ngpc.rxt.io/v1/namespaces/{namespace}/spotnodepools', {
      params: { path: { namespace } },
    });

    if (error) {
      throw new Error(`Failed to list spot node pools: ${JSON.stringify(error)}`);
    }

    return data;
  }

  async listOnDemandNodePools(namespace: string) {
    const { data, error } = await this.client.GET('/apis/ngpc.rxt.io/v1/namespaces/{namespace}/ondemandnodepools', {
      params: { path: { namespace } },
    });

    if (error) {
      throw new Error(`Failed to list on-demand node pools: ${JSON.stringify(error)}`);
    }

    return data;
  }
}
