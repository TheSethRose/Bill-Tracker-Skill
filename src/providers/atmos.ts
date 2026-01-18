/**
 * Atmos Energy Provider
 * 
 * Fetches gas bill data from atmosenergy.com
 * Uses browser automation to handle the login and billing page.
 * 
 * Credentials required in .env:
 * - ATMOS_EMAIL=your-email
 * - ATMOS_PASS=your-password
 */

import { Bill, ProviderConfig, ProviderCategory } from '../provider.js';
import * as fs from 'fs';
import * as path from 'path';

export class AtmosEnergyProvider {
  name = 'Atmos Energy';
  category: ProviderCategory = 'utility';
  method: 'browser' = 'browser';
  config: ProviderConfig = {
    loginUrl: 'https://www.atmosenergy.com/accountcenter/logon/login.html',
    envVars: ['ATMOS_EMAIL', 'ATMOS_PASS'],
  };

  private loginUrl = 'https://www.atmosenergy.com/accountcenter/logon/login.html';
  private dashboardUrl = 'https://www.atmosenergy.com/accountcenter/landing/landingScreen.html';

  private sessionName = 'atmos-energy-bill';
  private cookieDir = path.join(process.cwd(), 'sessions');

  async fetch(): Promise<Bill[]> {
    this.ensureCookieDir();
    const sessionRestored = await this.tryRestoreSession();
    
    if (!sessionRestored) {
      console.log('Logging into Atmos Energy...');
      await this.login();
    } else {
      console.log('Using existing Atmos Energy session...');
    }

    return [await this.fetchBill()];
  }

  private ensureCookieDir(): void {
    if (!fs.existsSync(this.cookieDir)) {
      fs.mkdirSync(this.cookieDir, { recursive: true });
    }
  }

  private getCookiePath(): string {
    return path.join(this.cookieDir, 'atmos-session.json');
  }

  private async tryRestoreSession(): Promise<boolean> {
    try {
      const cookiePath = this.getCookiePath();
      if (!fs.existsSync(cookiePath)) return false;

      const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
      const now = Date.now();
      if (cookies.expiresAt && now > cookies.expiresAt) return false;

      try {
        this.exec('close');
      } catch {}

      this.exec('open "https://www.atmosenergy.com/accountcenter/logon/login.html"');
      this.wait(3000);

      if (cookies.data && Array.isArray(cookies.data)) {
        for (const cookie of cookies.data) {
          try {
            this.exec(`cookies set "${cookie.name}" "${cookie.value}"`);
          } catch {}
        }
      }

      this.exec('open "https://www.atmosenergy.com/accountcenter/landing/landingScreen.html"');
      this.wait(3000);

      const url = this.exec('get url');
      return url.includes('landing') || url.includes('accountcenter');
    } catch {
      return false;
    }
  }

  private async login(): Promise<void> {
    const email = process.env.ATMOS_EMAIL || '';
    const password = process.env.ATMOS_PASS || '';

    try {
      this.exec('close');
    } catch {}

    // Go directly to login page
    this.exec('open "https://www.atmosenergy.com/accountcenter/logon/login.html"');
    this.wait(5000);  // Wait for page to load

    // Fill form using JavaScript - check repeatedly for form elements
    const escapedEmail = email.replace(/'/g, "\\'");
    const escapedPassword = password.replace(/'/g, "\\'");
    
    // Simple approach - just wait for elements and fill
    const jsCode = `
      (function() {
        var attempts = 0;
        var maxAttempts = 15;
        function tryFill() {
          var user = document.querySelector('input[name=username]');
          var pass = document.querySelector('input[name=password]');
          if (user && pass) {
            user.value = '${escapedEmail}';
            pass.value = '${escapedPassword}';
            pass.closest('form').submit();
            return 'success';
          }
          if (attempts < maxAttempts) {
            attempts++;
            var start = Date.now();
            while (Date.now() - start < 500) {}  // Wait 500ms
            return tryFill();
          }
          return 'timeout';
        }
        return tryFill();
      })()
    `;
    this.execEval(jsCode);
    this.wait(8000);

    // Navigate to dashboard
    this.exec('open "https://www.atmosenergy.com/accountcenter/landing/landingScreen.html"');
    this.wait(3000);

    await this.saveSession();
  }

  private async saveSession(): Promise<void> {
    try {
      const cookiePath = this.getCookiePath();
      const cookiesRaw = this.exec('cookies');
      
      const cookies: Array<{name: string; value: string}> = [];
      const pairs = cookiesRaw.split(';').map(c => c.trim()).filter(c => c);
      for (const pair of pairs) {
        const [name, ...valueParts] = pair.split('=');
        if (name && valueParts.length > 0) {
          cookies.push({ name, value: valueParts.join('=') });
        }
      }

      const sessionData = {
        savedAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        data: cookies,
      };

      fs.writeFileSync(cookiePath, JSON.stringify(sessionData, null, 2));
      console.log('Session saved to', cookiePath);
    } catch (error) {
      console.log('Failed to save session:', error);
    }
  }

  private async fetchBill(): Promise<Bill> {
    try {
      console.log('Fetching Atmos Energy bill...');

      // Check if systems are available
      const pageData = this.execEval(`
        const heading = document.querySelector('h1');
        const errorText = heading?.textContent?.trim() || '';
        const systemUnavailable = document.body.textContent.includes('systems are temporarily unavailable');
        JSON.stringify({ error: errorText, unavailable: systemUnavailable });
      `);

      const pageInfo = JSON.parse(pageData || '{}');
      
      if (pageInfo.error === 'Error' || pageInfo.unavailable) {
        console.log('  → Atmos Energy systems temporarily unavailable');
        console.log('  → Try again later or check https://www.atmosenergy.com');
        return {
          provider: 'Atmos Energy',
          category: 'utility',
          amount: 0,
          currency: 'USD',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'pending',
          lastUpdated: new Date(),
          payUrl: 'https://www.atmosenergy.com/accountcenter/finance/FinancialTransaction.html?activeTab=2',
        };
      }

      const billData = this.execEval(`
        const data = {};
        // Amount due
        const amountEl = document.querySelector('[class*="amount"], [class*="balance"], [id*="amount"]');
        if (amountEl) data.amount = amountEl.textContent.trim();
        // Due date
        const dueEl = document.querySelector('[class*="due"], [id*="due"], [class*="date"]');
        if (dueEl) data.dueDate = dueEl.textContent.trim();
        // Account number
        const acctEl = document.querySelector('[class*="account"], [id*="account"]');
        if (acctEl) data.account = acctEl.textContent.trim();
        JSON.stringify(data);
      `);

      const data = JSON.parse(billData || '{}');
      console.log('  → Raw data:', JSON.stringify(data));

      const amountText = data.amount?.replace(/[^0-9.]/g, '') || '0';
      const amount = parseFloat(amountText);
      const dueDate = this.parseDueDateText(data.dueDate);

      return {
        provider: 'Atmos Energy',
        category: 'utility',
        amount: isNaN(amount) ? 0 : amount,
        currency: 'USD',
        dueDate,
        status: this.calculateStatus(dueDate),
        lastUpdated: new Date(),
        accountLast4: data.account?.slice(-4) || undefined,
        payUrl: 'https://www.atmosenergy.com/accountcenter/landing/landingScreen.html',
      };
    } catch (error) {
      console.error('Failed to fetch Atmos Energy bill:', error);
      return {
        provider: 'Atmos Energy',
        category: 'utility',
        amount: 0,
        currency: 'USD',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        lastUpdated: new Date(),
        payUrl: 'https://www.atmosenergy.com/accountcenter/landing/landingScreen.html',
      };
    }
  }

  private parseDueDateText(text: string): Date {
    if (!text) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) return parsed;
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
    } catch {
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
    } catch {}
  }
}

export default AtmosEnergyProvider;
