/**
 * Scrape Access Method
 * 
 * Handles HTML scraping for providers with simple web portals.
 * Use for pages without APIs - beware of fragility to UI changes.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseProvider, Bill, ProviderConfig, ProviderCategory } from '../provider.js';

export class ScrapeProvider extends BaseProvider {
  private baseUrl: string;

  constructor(
    name: string,
    category: ProviderCategory,
    providerConfig: ProviderConfig
  ) {
    super();
    this.name = name;
    this.category = category;
    this.method = 'scrape';
    this.config = providerConfig;
    this.baseUrl = providerConfig.loginUrl || '';
  }

  name: string;
  category: ProviderCategory;
  method: 'scrape' = 'scrape';
  config: ProviderConfig;

  async fetch(): Promise<Bill> {
    const cookie = await this.authenticate();
    return this.scrapeBillPage(cookie);
  }

  protected async authenticate(): Promise<string> {
    const username = this.getEnv(this.config.envVars[0]);
    const password = this.getEnv(this.config.envVars[1]);

    const response = await axios.post(`${this.baseUrl}/login`, {
      username,
      password,
    }, {
      maxRedirects: 5,
      withCredentials: true,
    });

    const setCookie = response.headers['set-cookie'];
    return Array.isArray(setCookie) ? setCookie.join('; ') : setCookie || '';
  }

  protected async scrapeBillPage(cookie: string): Promise<Bill> {
    const response = await axios.get(`${this.baseUrl}/billing`, {
      headers: { Cookie: cookie },
    });

    const $ = cheerio.load(response.data);
    return {
      provider: this.name,
      category: this.category,
      amount: this.extractAmount($),
      currency: this.extractCurrency($) || 'USD',
      dueDate: this.extractDueDate($),
      status: this.determineStatus(this.extractDueDate($)),
      lastUpdated: new Date(),
      payUrl: this.extractPayUrl($),
    };
  }

  protected extractAmount(_$: cheerio.CheerioAPI): number {
    throw new Error('Not implemented - override in provider');
  }

  protected extractDueDate(_$: cheerio.CheerioAPI): Date {
    throw new Error('Not implemented - override in provider');
  }

  protected extractCurrency(_$: cheerio.CheerioAPI): string | null {
    return null;
  }

  protected extractPayUrl($: cheerio.CheerioAPI): string | undefined {
    const payLink = $('a[href*="pay"]').attr('href');
    return payLink ? `${this.baseUrl}${payLink}` : undefined;
  }

  protected determineStatus(dueDate: Date): Bill['status'] {
    const today = new Date();
    if (dueDate < today) return 'overdue';
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (dueDate <= weekFromNow) return 'due';
    return 'pending';
  }
}
