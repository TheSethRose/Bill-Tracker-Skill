/**
 * OAuth Access Method
 * 
 * Handles OAuth 2.0 flows for modern apps (banks, utilities, etc.)
 */

import axios, { AxiosInstance } from 'axios';
import { BaseProvider, Bill, ProviderConfig } from '../provider.js';

export class OAuthProvider extends BaseProvider {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private providerName: string,
    private category: Bill['category'],
    private config: ProviderConfig
  ) {
    super();
    this.client = axios.create({
      baseURL: config.apiBase,
      timeout: 30000,
    });
  }

  get name() { return this.providerName; }
  get category() { return this.category; }
  get method() { return 'oauth' as const; }
  get config() { return this.config; }

  async fetch(): Promise<Bill> {
    await this.ensureAuthenticated();
    return this.fetchBillData();
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return;
    }
    await this.authenticate();
  }

  private async authenticate(): Promise<void> {
    const clientId = this.getEnv(this.config.envVars[0]);
    const clientSecret = this.getEnv(this.config.envVars[1]);

    // Implement OAuth flow (client credentials or authorization code)
    const response = await axios.post(`${this.config.apiBase}/oauth/token`, {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);
    this.client.defaults.headers.common['Authorization'] = 
      `Bearer ${this.accessToken}`;
  }

  protected async fetchBillData(): Promise<Bill> {
    // Override in provider implementation
    throw new Error('Not implemented');
  }

  protected async getBalance(): Promise<number> {
    const endpoint = this.config.endpoints?.balance;
    if (!endpoint) throw new Error('No balance endpoint configured');
    const response = await this.client.get(endpoint);
    return this.extractBalance(response.data);
  }

  protected async getDueDate(): Promise<Date> {
    const endpoint = this.config.endpoints?.dueDate;
    if (!endpoint) throw new Error('No due date endpoint configured');
    const response = await this.client.get(endpoint);
    return this.parseDate(this.extractDueDate(response.data));
  }

  protected extractBalance(data: unknown): number {
    throw new Error('Not implemented');
  }

  protected extractDueDate(data: unknown): string | number | Date {
    throw new Error('Not implemented');
  }
}
