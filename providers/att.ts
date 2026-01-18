/**
 * AT&T Provider
 * 
 * Supports both AT&T Wireless and AT&T Internet accounts.
 * Uses browser automation to handle the modern SPA interface.
 * 
 * Credentials required in .env:
 * - ATT_USER=your-username
 * - ATT_PASS=your-password
 */

import { BrowserProvider } from '../methods/browser.js';
import { Bill } from '../provider.js';

export class ATTProvider extends BrowserProvider {
  constructor() {
    super('AT&T', 'utility', {
      loginUrl: 'https://www.att.com/myatt',
      envVars: ['ATT_USER', 'ATT_PASS'],
    });
  }

  async fetch(): Promise<Bill[]> {
    // AT&T can have multiple accounts - fetch both
    const [wireless, internet] = await Promise.all([
      this.fetchWirelessBill(),
      this.fetchInternetBill(),
    ]);

    return [wireless, internet].filter((b): b is Bill => b !== null);
  }

  private async fetchWirelessBill(): Promise<Bill | null> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    try {
      await page.goto('https://www.att.com/myatt');
      
      // Check if we need to log in
      const loginForm = page.locator('form[id="loginForm"], input[name="userID"]');
      if (await loginForm.isVisible()) {
        await this.login(page);
      }

      // Wait for dashboard to load
      await page.waitForLoadState('networkidle');

      // Try to find wireless account section
      // Look for account selector or wireless-specific elements
      const accountCards = page.locator('[class*="account"], [class*="wireless"]');
      const cardCount = await accountCards.count();

      if (cardCount > 0) {
        // Click first account (wireless typically first)
        await accountCards.first().click();
        await page.waitForTimeout(1000);
      }

      // Extract balance and due date
      const balanceText = await page.locator('[class*="balance"], [class*="amount"], [data-testid*="balance"]').first().textContent();
      const dueDateText = await page.locator('[class*="due"], [data-testid*="due"]').first().textContent();

      return {
        provider: 'AT&T Wireless',
        category: 'utility',
        amount: this.parseCurrency(balanceText || '0'),
        currency: 'USD',
        dueDate: this.parseDate(dueDateText || new Date()),
        status: this.determineStatus(this.parseDate(dueDateText || new Date())),
        lastUpdated: new Date(),
        accountLast4: await this.getAccountLast4(page),
      };
    } catch (error) {
      console.error('Failed to fetch AT&T Wireless bill:', error);
      return null;
    } finally {
      await page.close();
    }
  }

  private async fetchInternetBill(): Promise<Bill | null> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    try {
      await page.goto('https://www.att.com/myatt');
      await page.waitForLoadState('networkidle');

      // Look for internet account toggle/selector
      // AT&T often has an account switcher dropdown
      const accountSwitcher = page.locator('[class*="accountSwitcher"], select[id*="account"], button[class*="changeAccount"]');
      
      if (await accountSwitcher.isVisible()) {
        // Would need to handle account selection
        // This is a simplified version - real implementation needs account list
        console.log('Account switcher found - implementation needed');
      }

      return null; // Placeholder - needs account enumeration
    } catch (error) {
      console.error('Failed to fetch AT&T Internet bill:', error);
      return null;
    } finally {
      await page.close();
    }
  }

  private async login(page: import('playwright').Page): Promise<void> {
    const username = this.getEnv('ATT_USER');
    const password = this.getEnv('ATT_PASS');

    // AT&T login flow varies - try common selectors
    const userInput = page.locator('input[name="userID"], input[id*="username"], input[type="email"]');
    const passInput = page.locator('input[name="password"], input[id*="password"], input[type="password"]');
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button[id*="login"]');

    if (await userInput.isVisible()) {
      await userInput.fill(username);
    }
    
    if (await passInput.isVisible()) {
      await passInput.fill(password);
    }

    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }

    // Handle potential MFA
    await this.handleMFA(page);
  }

  private async handleMFA(page: import('playwright').Page): Promise<void> {
    // Check for MFA prompt
    const mfaInput = page.locator('input[id*="mfa"], input[id*="code"], input[name*="verification"]');
    
    if (await mfaInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('MFA required - please enter code manually or configure SMS/email bypass');
      await mfaInput.waitFor({ timeout: 120000 }); // Wait 2 min for manual entry
    }
  }

  private async getAccountLast4(page: import('playwright').Page): Promise<string | undefined> {
    const last4Text = await page.locator('[class*="last4"], [class*="accountNumber"], [data-testid*="last4"]').first().textContent();
    if (last4Text) {
      const match = last4Text.match(/\d{4}/);
      return match ? match[0] : undefined;
    }
    return undefined;
  }
}

export default ATTProvider;
