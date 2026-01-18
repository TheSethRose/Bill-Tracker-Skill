/**
 * Browser Access Method
 * 
 * Handles headless browser automation for JS-heavy apps and CAPTCHAs.
 * Slower but handles complex authentication flows.
 */

import { chromium, Browser, Page } from 'playwright';
import { BaseProvider, Bill, ProviderConfig } from '../provider.js';

export class BrowserProvider extends BaseProvider {
  private browser: Browser | null = null;

  constructor(
    private providerName: string,
    private category: Bill['category'],
    private config: ProviderConfig
  ) {
    super();
  }

  get name() { return this.providerName; }
  get category() { return this.category; }
  get method() { return 'browser' as const; }
  get config() { return this.config; }

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

  protected async login(page: Page): Promise<void> {
    const username = this.getEnv(this.config.envVars[0]);
    const password = this.getEnv(this.config.envVars[1]);

    await page.goto(this.config.loginUrl || '');
    await page.fill('input[name="username"], input[name="email"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForLoadState('networkidle');
  }

  protected async extractBillData(page: Page): Promise<Bill> {
    throw new Error('Not implemented - override in provider');
  }

  protected async getBalance(page: Page): Promise<number> {
    const balanceText = await page.locator('.balance, [data-testid="balance"]').textContent();
    return this.parseCurrency(balanceText || '0');
  }

  protected async getDueDate(page: Page): Promise<Date> {
    const dueText = await page.locator('.due-date, [data-testid="due-date"]').textContent();
    if (!dueText) throw new Error('Due date not found');
    return this.parseDate(dueText);
  }

  protected parseCurrency(text: string): number {
    const cleaned = text.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
}
