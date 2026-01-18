/**
 * Provider Interface
 * 
 * Defines the contract for bill provider implementations.
 * Providers can use different access methods: API, OAuth, Scrape, or Browser.
 */

export interface ProviderConfig {
  loginUrl?: string;
  apiBase?: string;
  envVars: string[];
  endpoints?: {
    balance?: string;
    dueDate?: string;
    auth?: string;
  };
  auth?: {
    type: 'basic' | 'bearer' | 'cookie' | 'session';
    headerPrefix?: string;
  };
}

export interface Bill {
  provider: string;
  category: 'utility' | 'bank' | 'credit' | 'insurance' | 'subscription' | 'other';
  amount: number;
  currency: string;
  dueDate: Date;
  status: 'pending' | 'due' | 'overdue' | 'paid';
  lastUpdated: Date;
  payUrl?: string;
  accountLast4?: string;
}

export type ProviderCategory = Bill['category'];

export interface Provider {
  name: string;
  category: ProviderCategory;
  method: 'api' | 'oauth' | 'scrape' | 'browser';
  config: ProviderConfig;
  fetch(): Promise<Bill | Bill[]>;
}

/**
 * Provider Template (for contributors)
 * Copy this file to providers/ and customize
 */
export abstract class BaseProvider implements Provider {
  abstract name: string;
  abstract category: ProviderCategory;
  abstract method: Provider['method'];
  abstract config: ProviderConfig;

  abstract fetch(): Promise<Bill | Bill[]>;

  protected getEnv(varName: string): string {
    const value = process.env[varName];
    if (!value) {
      throw new Error(`Missing environment variable: ${varName}`);
    }
    return value;
  }

  protected parseDate(dateStr: string | number | Date): Date {
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === 'number') {
      // Unix timestamp
      return new Date(dateStr * 1000);
    }
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    return parsed;
  }

  protected formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }
}
