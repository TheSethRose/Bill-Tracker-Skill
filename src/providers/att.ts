/**
 * AT&T Provider using Agent-Browser with Session Persistence
 * 
 * Supports both AT&T Wireless and AT&T Internet accounts.
 * Uses cookie-based sessions to avoid repeated logins and lockouts.
 * 
 * Credentials required in .env:
 * - ATT_USER=your-email@att.net
 * - ATT_PASS=your-password
 */

import { Bill, ProviderConfig, ProviderCategory } from '../provider.js';
import * as fs from 'fs';
import * as path from 'path';

export class ATTProvider {
  name = 'AT&T';
  category: ProviderCategory = 'utility';
  method: 'browser' = 'browser';
  config: ProviderConfig = {
    loginUrl: 'https://www.att.com/myatt',
    envVars: ['ATT_USER', 'ATT_PASS'],
  };

  private sessionName = 'att-bill-tracker';
  private cookieDir = path.join(process.cwd(), 'sessions');

  async fetch(): Promise<Bill[]> {
    // Ensure cookie directory exists
    this.ensureCookieDir();

    // Try to restore session from cookies first
    const sessionRestored = await this.tryRestoreSession();
    
    if (!sessionRestored) {
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

  private ensureCookieDir(): void {
    if (!fs.existsSync(this.cookieDir)) {
      fs.mkdirSync(this.cookieDir, { recursive: true });
    }
  }

  private getCookiePath(): string {
    return path.join(this.cookieDir, 'att-session.json');
  }

  private async tryRestoreSession(): Promise<boolean> {
    try {
      const cookiePath = this.getCookiePath();
      if (!fs.existsSync(cookiePath)) {
        return false;
      }

      // Read saved cookies
      const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
      
      // Check if cookies are expired
      const now = Date.now();
      if (cookies.expiresAt && now > cookies.expiresAt) {
        console.log('Session expired, need to login again');
        return false;
      }

      // Close any existing session first
      try {
        this.exec('close');
      } catch {
        // Ignore
      }

      // Open the overview page directly
      this.exec('open https://www.att.com/acctmgmt/overview');
      this.wait(3000);

      // Try to inject cookies
      if (cookies.data && Array.isArray(cookies.data)) {
        for (const cookie of cookies.data) {
          try {
            this.exec(`cookies set "${cookie.name}" "${cookie.value}"`);
          } catch {
            // Ignore individual cookie errors
          }
        }
      }

      // Navigate to overview page again
      this.exec('open https://www.att.com/acctmgmt/overview');
      this.wait(3000);

      // Check if we're on the overview page (logged in)
      const url = this.exec('get url');
      return url.includes('overview') || url.includes('myatt');
    } catch (error) {
      console.log('Failed to restore session:', error);
      return false;
    }
  }

  private async login(): Promise<void> {
    const username = process.env.ATT_USER || '';
    const password = process.env.ATT_PASS || '';

    // Close any existing session first
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
    // Wait for login to complete
    this.wait(5000);

    // Navigate to overview page
    this.exec('open https://www.att.com/acctmgmt/overview');
    this.wait(3000);

    // Save session cookies
    await this.saveSession();
  }

  private async saveSession(): Promise<void> {
    try {
      const cookiePath = this.getCookiePath();
      
      // Get cookies from agent-browser - it returns format like "name=value; name2=value2"
      const cookiesRaw = this.exec('cookies');
      
      // Parse cookies from "name=value; name2=value2" format
      const cookies: Array<{name: string; value: string}> = [];
      const pairs = cookiesRaw.split(';').map(c => c.trim()).filter(c => c);
      for (const pair of pairs) {
        const [name, ...valueParts] = pair.split('=');
        if (name && valueParts.length > 0) {
          cookies.push({ name, value: valueParts.join('=') });
        }
      }

      // Save with expiration
      const sessionData = {
        savedAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        data: cookies,
      };

      fs.writeFileSync(cookiePath, JSON.stringify(sessionData, null, 2));
      console.log('Session saved to', cookiePath);
    } catch (error) {
      console.log('Failed to save session:', error);
    }
  }

  private async fetchAccount(type: 'wireless' | 'internet', last4: string, testid: string): Promise<Bill | null> {
    try {
      // Click on the account to switch to it
      this.exec(`find testid "${testid}" click`);
      this.wait(2000);

      // Extract all available data as text
      const pageData = this.execEval(`
        const data = {};
        // Balance amount
        const balanceEl = document.querySelector('.type-60');
        if (balanceEl) data.balance = balanceEl.textContent.trim();
        // Account number
        const acctEl = document.querySelector('[class*="accountNumber"]');
        if (acctEl) data.accountNumber = acctEl.textContent.trim();
        // Due date
        const dueEl = document.querySelector('[class*="due"], .type-15');
        if (dueEl) data.dueDate = dueEl.textContent.trim();
        // Min due
        const minDueEl = document.querySelector('[class*="minDue"], [class*="minimum"]');
        if (minDueEl) data.minDue = minDueEl.textContent.trim();
        // Status text
        const statusEl = document.querySelector('[class*="status"]');
        if (statusEl) data.status = statusEl.textContent.trim();
        JSON.stringify(data);
      `);

      const data = JSON.parse(pageData || '{}');

      console.log(`\n=== AT&T ${type.toUpperCase()} ===`);
      console.log(`Account: ****${last4}`);
      console.log(`Balance: ${data.balance || 'N/A'}`);
      console.log(`Due Date: ${data.dueDate || 'N/A'}`);
      console.log(`Min Due: ${data.minDue || 'N/A'}`);
      console.log(`Status: ${data.status || 'N/A'}`);

      const balanceText = data.balance?.replace(/[^0-9.]/g, '') || '0';
      const balance = parseFloat(balanceText);
      const dueDate = this.parseDueDateText(data.dueDate);

      return {
        provider: `AT&T ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        category: 'utility',
        amount: isNaN(balance) ? 0 : balance,
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

  private parseDueDateText(text: string): Date {
    if (!text) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) return parsed;
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  private async extractBalance(): Promise<number> {
    try {
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
