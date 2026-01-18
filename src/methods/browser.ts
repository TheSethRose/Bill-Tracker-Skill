/**
 * Browser Access Method
 * 
 * Handles headless browser automation for JS-heavy apps and CAPTCHAs.
 * Slower but handles complex authentication flows.
 */

import { chromium, Browser, Page } from 'playwright';
import { BaseProvider, Bill, ProviderConfig, ProviderCategory } from '../provider.js';

export class BrowserProvider extends BaseProvider {
  browser: Browser | null = null;

  constructor(
    name: string,
    category: ProviderCategory,
    private providerConfig: ProviderConfig
  ) {
    super();
    this.name = name;
    this.category = category;
    this.method = 'browser';
    this.config = providerConfig;
  }

  name: string;
  category: ProviderCategory;
  method: 'browser' = 'browser';
  config: ProviderConfig;

  async fetch(): Promise<Bill> {
    this.browser = await chromium.launch({ headless: true });
    try {
      const page = await this.browser.newPage();
      await this.login(page);
      return await this.extractBillData(page);
    } finally {
      await this.browser.close();
    }
  }

  protected async login(_page: Page): Promise<void> {
    const username = this.getEnv(this.config.envVars[0]);
    const password = this.getEnv(this.config.envVars[1]);

    throw new Error('Override login() in provider implementation');
  }

  protected async extractBillData(_page: Page): Promise<Bill> {
    throw new Error('Override extractBillData() in provider implementation');
  }

  protected async getBalance(page: Page): Promise<number> {
    const balanceText = await page.locator('.balance, [data-testid="balance"]').first().textContent();
    return this.parseCurrency(balanceText || '0');
  }

  protected async getDueDate(page: Page): Promise<Date> {
    const dueText = await page.locator('.due-date, [data-testid="due-date"]').first().textContent();
    if (!dueText) throw new Error('Due date not found');
    return this.parseDate(dueText);
  }

  protected parseCurrency(text: string): number {
    const cleaned = text.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
}
