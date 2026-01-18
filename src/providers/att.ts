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

import { Bill, ProviderConfig, ProviderCategory } from '../provider.js';

export class ATTProvider {
  name = 'AT&T';
  category: ProviderCategory = 'utility';
  method: 'browser' = 'browser';
  config: ProviderConfig = {
    loginUrl: 'https://www.att.com/myatt',
    envVars: ['ATT_USER', 'ATT_PASS'],
  };

  private sessionName = 'att-bill-tracker';

  async fetch(): Promise<Bill[]> {
    const isLoggedIn = await this.checkSession();
    
    if (!isLoggedIn) {
      console.log('Logging into AT&T...');
      await this.login();
    } else {
      console.log('Using existing AT&T session...');
    }

    const [wireless, internet] = await Promise.all([
      this.fetchAccount('wireless', '177125913995', 'Wireless-177125913995'),
      this.fetchAccount('internet', '337740445', 'Internet-337740445'),
    ]);

    return [wireless, internet].filter((b): b is Bill => b !== null);
  }

  private async checkSession(): Promise<boolean> {
    try {
      const url = this.exec('get url');
      return url.includes('myatt') && !url.includes('signin.att.com');
    } catch {
      return false;
    }
  }

  private async login(): Promise<void> {
    const username = process.env.ATT_USER || '';
    const password = process.env.ATT_PASS || '';

    // Close any existing session first to start fresh
    try {
      this.exec('close');
    } catch {
      // Ignore
    }

    // Open the myATT page - it will redirect to login
    this.exec('open https://www.att.com/myatt');
    this.wait(3000);

    // Fill username
    this.exec(`find label "User ID" fill "${username}"`);
    this.wait(500);

    // Click Continue (AT&T uses a 2-step login)
    this.exec('find text "Continue" click');
    this.wait(2000);

    // Now password field should be visible - fill using CSS selector
    this.exec('fill "input[type=\'password\']" ""');
    this.exec(`fill "input[type='password']" "${password}"`);
    this.wait(500);

    // Click Sign In using the ID selector
    this.exec('click "#signin"');
    // Wait for login to complete and redirect back
    this.wait(5000);
  }

  private async fetchAccount(type: 'wireless' | 'internet', last4: string, testid: string): Promise<Bill | null> {
    try {
      console.log(`Fetching AT&T ${type} (****${last4})...`);

      // Click on the account to switch to it
      this.exec(`find testid "${testid}" click`);
      this.wait(2000);

      // Get the balance
      const balance = await this.extractBalance();
      const dueDate = await this.extractDueDate();

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
    try {
      // Get the balance using JavaScript evaluation
      const balanceText = this.execEval(
        "document.querySelector('.type-60')?.textContent?.replace(/[^0-9.]/g, '') || '0'"
      );
      const balance = parseFloat(balanceText);
      return isNaN(balance) ? 0 : balance;
    } catch {
      return 0;
    }
  }

  private async extractDueDate(): Promise<Date> {
    try {
      // Look for due date using JavaScript
      const dueText = this.execEval(
        "document.body.innerText.match(/Due[:\\s]+([A-Za-z0-9,\\/\\s]+)/i)?.[1] || ''"
      );
      
      if (dueText) {
        const parsed = new Date(dueText);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    } catch {
      // Fall through
    }

    // Default: 30 days from now
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  private calculateStatus(dueDate: Date): Bill['status'] {
    const today = new Date();
    if (dueDate < today) return 'overdue';
    
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (dueDate <= weekFromNow) return 'due';
    
    return 'pending';
  }

  private exec(command: string): string {
    const { execSync } = require('child_process');
    const fullCmd = `agent-browser --session ${this.sessionName} ${command}`;
    try {
      const output = execSync(fullCmd, { encoding: 'utf-8', timeout: 30000 });
      // Strip ANSI codes
      return output.replace(/\x1b\[[0-9;]*m/g, '').trim();
    } catch (error: any) {
      console.log(`Command failed: ${command}`);
      return '';
    }
  }

  private execEval(script: string): string {
    const { execSync } = require('child_process');
    const escapedScript = script.replace(/"/g, '\\"');
    const fullCmd = `agent-browser --session ${this.sessionName} eval "${escapedScript}"`;
    try {
      const output = execSync(fullCmd, { encoding: 'utf-8', timeout: 10000 });
      return output.replace(/\x1b\[[0-9;]*m/g, '').trim();
    } catch {
      return '';
    }
  }

  private wait(ms: number): void {
    const { execSync } = require('child_process');
    execSync(`agent-browser --session ${this.sessionName} wait ${ms}`, { encoding: 'utf-8', timeout: ms + 5000 });
  }

  async close(): Promise<void> {
    try {
      this.exec('close');
    } catch {
      // Ignore
    }
  }
}

export default ATTProvider;
