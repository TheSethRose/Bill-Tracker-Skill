/**
 * Bill Aggregator
 * 
 * Fetches bills from all configured providers and normalizes the data.
 */

import { Bill, Provider, loadProviders } from './provider.js';

export class Aggregator {
  constructor(private providers: Provider[]) {}

  async fetchAllBills(): Promise<Bill[]> {
    const results = await Promise.allSettled(
      this.providers.map(async (provider) => {
        try {
          return await provider.fetch();
        } catch (error) {
          console.error(`Failed to fetch from ${provider.name}:`, error);
          return null;
        }
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<Bill> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  async fetchByCategory(category: Provider['category']): Promise<Bill[]> {
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

  getTotalDue(): number {
    // This would need bills passed in - using a different pattern
    return 0;
  }
}

/**
 * Load all configured providers from the providers directory
 */
export async function loadProviders(): Promise<Provider[]> {
  // Dynamic import of provider modules
  // Each provider file should export a default class extending BaseProvider
  const providers: Provider[] = [];
  
  try {
    const providerFiles = await this.getProviderFiles();
    for (const file of providerFiles) {
      try {
        const module = await import(file);
        const ProviderClass = module.default || module.Provider;
        if (ProviderClass) {
          const instance = new ProviderClass();
          if (instance instanceof Provider || 'fetch' in instance) {
            providers.push(instance);
          }
        }
      } catch (error) {
        console.error(`Failed to load provider ${file}:`, error);
      }
    }
  } catch {
    // No providers configured yet
  }

  return providers;
}

async function getProviderFiles(): Promise<string[]> {
  const fs = await import('fs');
  const path = await import('path');
  
  const providersDir = path.join(process.cwd(), 'providers');
  if (!fs.existsSync(providersDir)) return [];
  
  const files = fs.readdirSync(providersDir);
  return files
    .filter((f) => f.endsWith('.js') || f.endsWith('.ts'))
    .map((f) => path.join(providersDir, f));
}
