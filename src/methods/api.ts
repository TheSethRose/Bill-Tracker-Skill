/**
 * API Access Method
 * 
 * Handles direct REST/GraphQL API calls for providers with official APIs.
 */

import axios, { AxiosInstance } from 'axios';
import { BaseProvider, Bill, ProviderConfig } from '../provider.js';

export class ApiProvider extends BaseProvider {
  private client: AxiosInstance;
  
  constructor(
    private providerName: string,
    private category: Bill['category'],
    private config: ProviderConfig
  ) {
    super();
    this.client = axios.create({
      baseURL: config.apiBase,
      timeout: 30000,
      headers: config.auth
        ? {
            ...(config.auth.type === 'basic' && this.getBasicAuthHeader()),
          }
        : {},
    });
  }

  get name() { return this.providerName; }
  get category() { return this.category; }
  get method() { return 'api' as const; }
  get config() { return this.config; }

  async fetch(): Promise<Bill> {
    // Implement provider-specific logic
    throw new Error('Not implemented');
  }

  protected getBasicAuthHeader(): Record<string, string> {
    const user = this.getEnv(this.config.envVars[0]);
    const pass = this.getEnv(this.config.envVars[1]);
    const token = Buffer.from(`${user}:${pass}`).toString('base64');
    return { Authorization: `Basic ${token}` };
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
    // Override in provider implementation
    throw new Error('Not implemented');
  }

  protected extractDueDate(data: unknown): string | number | Date {
    // Override in provider implementation
    throw new Error('Not implemented');
  }
}
