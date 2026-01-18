/**
 * API Access Method
 * 
 * Handles direct REST/GraphQL API calls for providers with official APIs.
 */

import axios, { AxiosInstance } from 'axios';
import { BaseProvider, Bill, ProviderConfig, ProviderCategory } from '../provider.js';

export class ApiProvider extends BaseProvider {
  private client: AxiosInstance;
  
  constructor(
    name: string,
    category: ProviderCategory,
    private providerConfig: ProviderConfig
  ) {
    super();
    this.name = name;
    this.category = category;
    this.method = 'api';
    this.config = providerConfig;
    
    this.client = axios.create({
      baseURL: providerConfig.apiBase,
      timeout: 30000,
      headers: providerConfig.auth
        ? {
            ...(providerConfig.auth.type === 'basic' && this.getBasicAuthHeader()),
          }
        : {},
    });
  }

  name: string;
  category: ProviderCategory;
  method: 'api' = 'api';
  config: ProviderConfig;

  async fetch(): Promise<Bill> {
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

  protected extractBalance(_data: unknown): number {
    throw new Error('Not implemented');
  }

  protected extractDueDate(_data: unknown): string | number | Date {
    throw new Error('Not implemented');
  }
}
