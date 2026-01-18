/**
 * Bill Aggregator
 * 
 * Fetches bills from all configured providers and normalizes the data.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Bill, Provider, BaseProvider, ProviderCategory } from './provider.js';

export class Aggregator {
  constructor(private providers: Provider[]) {}

  async fetchAllBills(): Promise<Bill[]> {
    const results = await Promise.allSettled(
      this.providers.map(async (provider) => {
        try {
          const result = await provider.fetch();
          return Array.isArray(result) ? result : [result];
        } catch (error) {
          console.error(`Failed to fetch from ${provider.name}:`, error);
          return [];
        }
      })
    );

    return results
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  async fetchByCategory(category: ProviderCategory): Promise<Bill[]> {
    const bills = await this.fetchAllBills();
    return bills.filter((b) => b.category === category);
  }

  async fetchOverdue(): Promise<Bill[]> {
    const bills = await this.fetchAllBills();
    const today = new Date();
    return bills.filter((b) => b.status === 'overdue' || b.dueDate < today);
  }

  async fetchDueSoon(days: number = 7): Promise<Bill[]> {
    const bills = await this.fetchAllBills();
    const soon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const today = new Date();
    return bills.filter((b) => b.dueDate >= today && b.dueDate <= soon);
  }
}

/**
 * Load all configured providers from the providers directory
 */
export async function loadProviders(): Promise<Provider[]> {
  const providers: Provider[] = [];
  
  try {
    const providerDir = path.join(process.cwd(), 'dist', 'providers');
    if (!fs.existsSync(providerDir)) return [];

    const files = fs.readdirSync(providerDir).filter(
      (f) => f.endsWith('.js') && !f.endsWith('.d.ts') && !f.startsWith('_')
    );

    for (const file of files) {
      // Skip template and JSON config files
      if (file.startsWith('_') || file.endsWith('.json')) continue;

      try {
        const filePath = path.join(providerDir, file);
        const module = await import(filePath);
        const ProviderClass = module.default || module.Provider;
        
        if (ProviderClass && typeof ProviderClass === 'function') {
          const instance = new ProviderClass();
          if (instance instanceof BaseProvider || 'fetch' in instance) {
            providers.push(instance);
          }
        }
      } catch (error) {
        console.error(`Failed to load provider ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error loading providers:', error);
  }

  return providers;
}
