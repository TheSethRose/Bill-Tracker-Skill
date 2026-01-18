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
 * Load configured providers from the providers directory
 * Filter by BILL_PROVIDERS env var (comma-separated list) or --provider CLI arg
 * If BILL_PROVIDERS is empty or not set, run all available providers
 */
export async function loadProviders(): Promise<Provider[]> {
  const providers: Provider[] = [];
  
  // Get configured providers from env
  const configured = (process.env.BILL_PROVIDERS || '').toLowerCase().split(',').map(p => p.trim()).filter(p => p);
  
  if (configured.length > 0) {
    console.log(`\n📋 Loading providers: ${configured.join(', ')}`);
  }

  try {
    const providerDir = path.join(process.cwd(), 'dist', 'providers');
    if (!fs.existsSync(providerDir)) return [];

    const files = fs.readdirSync(providerDir).filter(
      (f) => f.endsWith('.js') && !f.endsWith('.d.ts') && !f.startsWith('_')
    );

    for (const file of files) {
      // Skip template and JSON config files
      if (file.startsWith('_') || file.endsWith('.json')) continue;

      // Get provider name from filename (e.g., "att.js" -> "att")
      const providerName = file.replace('.js', '').toLowerCase();

      // Filter by configured providers if set
      if (configured.length > 0 && !configured.includes(providerName)) {
        continue;
      }

      try {
        const filePath = path.join(providerDir, file);
        const module = await import(filePath);
        const ProviderClass = module.default || module.Provider;
        
        if (ProviderClass && typeof ProviderClass === 'function') {
          const instance = new ProviderClass();
          if (instance instanceof BaseProvider || 'fetch' in instance) {
            providers.push(instance);
            console.log(`  ✓ ${instance.name}`);
          }
        }
      } catch (error) {
        console.error(`Failed to load provider ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error loading providers:', error);
  }

  if (configured.length > 0 && providers.length === 0) {
    console.log(`\n⚠️  No matching providers found. Check BILL_PROVIDERS in .env`);
    console.log(`   Available: att, atmos`);
  }

  return providers;
}
