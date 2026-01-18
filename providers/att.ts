/**
 * AT&T Provider using Agent-Browser
 * 
 * Supports both AT&T Wireless and AT&T Internet accounts.
 * Uses agent-browser CLI for reliable browser automation.
 * 
 * Session-based to avoid repeated logins and lockouts.
 * 
 * Credentials required in .env:
 * - ATT_USER=your-email@att.net
 * - ATT_PASS=your-password
 */

import { Bill, ProviderConfig } from '../provider.js';

export interface ATTAccount {
  type: 'wireless' | 'internet';
  last4: string;
  testid: string;
}

export class ATTProvider {
  name = 'AT&T';
  category = 'utility' as const;
  method = 'browser' as const;
  config: ProviderConfig = {
    loginUrl: 'https://www.att.com/myatt',
    envVars: ['ATT_USER', 'ATT_PASS'],
  };

  private sessionName = 'att-bill-tracker';

  async fetch(): Promise<Bill[]> {
    // Check if already logged in by checking session
    const isLoggedIn = await this.checkSession();
    
    if (!isLoggedIn) {
      console.log('Logging into AT&T...');
      await this.login();
    } else {
      console.log('Using existing AT&T session...');
    }

    // Fetch both accounts
    const [wireless, internet] = await Promise.all([
      this.fetchAccount('wireless', '177125913995', 'Wireless-177125913995'),
      this.fetchAccount('internet', '337740445', 'Internet-337740445'),
    ]);

    return [wireless, internet].filter((b): b is Bill => b !== null);
  }

  private async checkSession(): Promise<boolean> {
    const { execSync } = await import('child_process');
    try {
      // Check current URL - if on myatt without login redirect, we're good
      const url = execSync(
        `agent-browser --session ${this.sessionName} get url`,
        { encoding: 'utf-8', timeout: 10000 }
      ).trim();
      
      // Check if we see account cards (logged in state)
      const count = execSync(
        `agent-browser --session ${this.sessionName} get count "[data-testid*='Wireless']"`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();
      
      return parseInt(count) > 0;
    } catch {
      return false;
    }
  }

  private async login(): Promise<void> {
    const { execSync } = await import('child_process');
    const username = process.env.ATT_USER || '';
    const password = process.env.ATT_PASS || '';

    // Close any existing session first to start fresh
    try {
      execSync(`agent-browser --session ${this.sessionName} close`, { encoding: 'utf-8', timeout: 5000 });
    } catch {
      // Ignore
    }

    const steps = [
      `agent-browser --session ${this.sessionName} open https://www.att.com/myatt`,
      `agent-browser --session ${this.sessionName} wait --load networkidle`,
      // Wait for login form
      `agent-browser --session ${this.sessionName} wait 2000`,
      // Fill username - try multiple selectors
      `agent-browser --session ${this.sessionName} find label "User ID" fill "${username}"`,
      // Fill password
      `agent-browser --session ${this.sessionName} find label "Password" fill "${password}"`,
      // Click sign in
      `agent-browser --session ${this.sessionName} find text "Sign In" click`,
      // Wait for dashboard
      `agent-browser --session ${this.sessionName} wait --load networkidle`,
      `agent-browser --session ${this.sessionName} wait 3000`,
    ];

    for (const cmd of steps) {
      try {
        execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
      } catch (error: any) {
        console.log(`Step: ${cmd.split(' ').slice(2).join(' ')} - continuing...`);
      }
    }
  }

  private async fetchAccount(type: 'wireless' | 'internet', last4: string, testid: string): Promise<Bill | null> {
    const { execSync } = await import('child_process');

    try {
      console.log(`Fetching AT&T ${type} (****${last4})...`);

      // Click on the account to switch to it
      execSync(
        `agent-browser --session ${this.sessionName} find testid "${testid}" click`,
        { encoding: 'utf-8', timeout: 15000 }
      );

      // Wait for account content to load
      execSync(`agent-browser --session ${this.sessionName} wait 2000`, { encoding: 'utf-8' });

      // Get the balance using specific selectors from the HTML
      const balance = await this.extractBalance();
      
      // Get due date
      const dueDate = await this.extractDueDate();
      
      // Get additional info if available
      const minDue = await this.extractMinDue();

      console.log(`  → Balance: $${balance.toFixed(2)}, Due: ${dueDate.toLocaleDateString()}`);

      return {
        provider: `AT&T ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        category: 'utility',
        amount: balance,
        currency: 'USD',
        dueDate,
        status: this.calculateStatus(dueDate),
        lastUpdated: new Date(),
        accountLast4: last4,
        payUrl: 'https://www.att.com/myatt/billing',
      };
    } catch (error) {
      console.error(`Failed to fetch AT&T ${type}:`, error);
      return null;
    }
  }

  private async extractBalance(): Promise<number> {
    const { execSync } = await import('child_process');
    
    // Get the balance from the price section - look for type-60 class with dollar sign
    const balanceText = execSync(
      `agent-browser --session ${this.sessionName} eval "document.querySelector('.type-60')?.textContent?.replace(/[^0-9.]/g, '') || '0'"`,
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();

    const balance = parseFloat(balanceText);
    return isNaN(balance) ? 0 : balance;
  }

  private async extractDueDate(): Promise<Date> {
    const { execSync } = await import('child_process');
    
    // Look for due date in various places
    const dueDateSelectors = [
      '[class*="due"]',
      '[id*="due"]',
      '[data-testid*="due"]',
      '.type-15',
    ];

    for (const selector of dueDateSelectors) {
      try {
        const text = execSync(
          `agent-browser --session ${this.sessionName} eval "document.querySelector('${selector}')?.textContent || ''"`,
          { encoding: 'utf-8', timeout: 5000 }
        ).trim();
        
        if (text && !text.includes('undefined')) {
          const parsed = new Date(text);
          if (!isNaN(parsed.getTime())) return parsed;
        }
      } catch {
        continue;
      }
    }

    // Fallback: look for any date-like text on the page
    try {
      const pageText = execSync(
        `agent-browser --session ${this.sessionName} eval "document.body.innerText"`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      
      // Look for "Due" followed by a date
      const dueMatch = pageText.match(/Due[:\s]+([A-Za-z0-9,\s\/]+)/i);
      if (dueMatch) {
        const parsed = new Date(dueMatch[1]);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    } catch {
      // Fall through
    }

    // Default: 30 days from now
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  private async extractMinDue(): Promise<number> {
    const { execSync } = await import('child_process');
    
    try {
      const text = execSync(
        `agent-browser --session ${this.sessionName} eval "document.body.innerText"`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      
      // Look for "Minimum due" or similar
      const minMatch = text.match(/Minimum[:\s]*\$?([\d,]+\.?\d{0,2})/i);
      if (minMatch) {
        return parseFloat(minMatch[1].replace(/,/g, ''));
      }
    } catch {
      // Ignore
    }
    
    return 0;
  }

  private calculateStatus(dueDate: Date): Bill['status'] {
    const today = new Date();
    if (dueDate < today) return 'overdue';
    
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (dueDate <= weekFromNow) return 'due';
    
    return 'pending';
  }

  async close(): Promise<void> {
    // Keep session open for reuse, but can close explicitly if needed
    const { execSync } = await import('child_process');
    try {
      execSync(`agent-browser --session ${this.sessionName} close`, { encoding: 'utf-8', timeout: 5000 });
    } catch {
      // Ignore
    }
  }
}

export default ATTProvider;
