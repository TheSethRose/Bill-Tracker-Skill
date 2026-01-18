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
      await this.login();
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
      // Try to navigate to the dashboard and check for logged-in state
      const result = execSync(
        `agent-browser --session ${this.sessionName} open https://www.att.com/myatt && agent-browser --session ${this.sessionName} get url`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      
      // If we're on the dashboard (not login page), we're logged in
      return result.includes('myatt') && !result.includes('login');
    } catch {
      return false;
    }
  }

  private async login(): Promise<void> {
    const { execSync } = await import('child_process');
    const username = process.env.ATT_USER || '';
    const password = process.env.ATT_PASS || '';

    const cmds = [
      `agent-browser --session ${this.sessionName} open https://www.att.com/myatt`,
      `agent-browser --session ${this.sessionName} wait --load networkidle`,
      // Look for username field
      `agent-browser --session ${this.sessionName} find label "User ID" fill "${username}"`,
      `agent-browser --session ${this.sessionName} find label "Password" fill "${password}"`,
      `agent-browser --session ${this.sessionName} find label "Sign In" click`,
      `agent-browser --session ${this.sessionName} wait --load networkidle`,
      `agent-browser --session ${this.sessionName} wait 2000`,
    ];

    for (const cmd of cmds) {
      try {
        execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
      } catch (error) {
        console.log(`Command failed, continuing: ${cmd}`);
      }
    }

    // Save session state
    execSync(`agent-browser --session ${this.sessionName} cookies`, { encoding: 'utf-8' });
  }

  private async fetchAccount(type: 'wireless' | 'internet', last4: string, testid: string): Promise<Bill | null> {
    const { execSync } = await import('child_process');

    try {
      // Click on the account to switch to it
      execSync(
        `agent-browser --session ${this.sessionName} find testid "${testid}" click`,
        { encoding: 'utf-8', timeout: 15000 }
      );

      // Wait for the account content to load
      execSync(`agent-browser --session ${this.sessionName} wait 1500`, { encoding: 'utf-8' });

      // Get balance - look for amount elements
      const balanceResult = execSync(
        `agent-browser --session ${this.sessionName} snapshot --json`,
        { encoding: 'utf-8', timeout: 15000 }
      );

      // Parse balance from snapshot
      const balance = this.extractBalance(balanceResult);

      // Get due date
      const dueDateResult = execSync(
        `agent-browser --session ${this.sessionName} find text "Due" text`,
        { encoding: 'utf-8', timeout: 10000 }
      );

      const dueDate = this.parseDueDate(dueDateResult);

      return {
        provider: `AT&T ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        category: 'utility',
        amount: balance,
        currency: 'USD',
        dueDate,
        status: this.calculateStatus(dueDate),
        lastUpdated: new Date(),
        accountLast4: last4,
      };
    } catch (error) {
      console.error(`Failed to fetch AT&T ${type} bill:`, error);
      return null;
    }
  }

  private extractBalance(snapshotJson: string): number {
    try {
      const snapshot = JSON.parse(snapshotJson);
      // Look for elements containing currency patterns
      const text = JSON.stringify(snapshot);
      const matches = text.match(/\$[\d,]+\.?\d{0,2}/g);
      if (matches && matches.length > 0) {
        const cleaned = matches[0].replace(/[$,]/g, '');
        return parseFloat(cleaned) || 0;
      }
    } catch {
      // Fallback parsing
    }
    return 0;
  }

  private parseDueDate(text: string): Date {
    // Try to parse common date formats
    const now = new Date();
    
    // Look for "Due [date]" pattern
    const dueMatch = text.match(/Due[:\s]+(.+)/i);
    if (dueMatch) {
      const parsed = new Date(dueMatch[1]);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // Fallback: assume same day or next billing cycle
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
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
      execSync(`agent-browser --session ${this.sessionName} close`, { encoding: 'utf-8' });
    } catch {
      // Ignore close errors
    }
  }
}

export default ATTProvider;
