/**
 * Bill Aggregator
 * 
 * Fetches bills from configured providers with caching support.
 * Data is cached in data/ directory and reused if less than 24h old.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Bill, Provider, BaseProvider, ProviderCategory } from './provider.js';

const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class Aggregator {
  constructor(private providers: Provider[]) {}

  async fetchAllBills(): Promise<Bill[]> {
    const forceFetch = process.env.BILL_FORCE_FETCH === 'true';
    const results = await Promise.allSettled(
      this.providers.map(async (provider) => {
        const cachePath = this.getCachePath(provider.name);
        
        // Try to load from cache first (unless --force)
        if (!forceFetch && fs.existsSync(cachePath)) {
          const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
          const age = Date.now() - cached.timestamp;
          if (age < CACHE_TTL) {
            console.log(`  📦 Using cached ${provider.name} data (${Math.round(age/3600000)}h old)`);
            return cached.bills;
          }
        }

        // Fetch fresh data
        try {
          console.log(`  🔄 Fetching fresh ${provider.name} data...`);
          const result = await provider.fetch();
          const bills = Array.isArray(result) ? result : [result];
          
          // Save to cache
          this.saveCache(provider.name, bills);
          return bills;
        } catch (error) {
          console.error(`Failed to fetch from ${provider.name}:`, error);
          // Try to return stale cache as fallback
          if (fs.existsSync(cachePath)) {
            const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
            console.log(`  ⚠️  Using stale cache for ${provider.name}`);
            return cached.bills;
          }
          return [];
        }
      })
    );

    return results
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  private getCachePath(providerName: string): string {
    return path.join(CACHE_DIR, `${providerName.toLowerCase()}.json`);
  }

  private saveCache(providerName: string, bills: Bill[]): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cachePath = this.getCachePath(providerName);
    fs.writeFileSync(cachePath, JSON.stringify({
      timestamp: Date.now(),
      provider: providerName,
      bills
    }, null, 2));
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
 * Only loads providers listed in BILL_PROVIDERS env var (comma-separated)
 * Use --provider CLI arg to run a single provider for testing
 */
export async function loadProviders(): Promise<Provider[]> {
  const providers: Provider[] = [];
  
  // Get configured providers from env
  const configured = (process.env.BILL_PROVIDERS || '').toLowerCase().split(',').map(p => p.trim()).filter(p => p);
  
  if (configured.length > 0) {
    console.log(`\n📋 Configured providers: ${configured.join(', ')}`);
  } else {
    console.log(`\n⚠️  No providers configured. Set BILL_PROVIDERS in .env or use --provider=`);
    console.log(`   Available: att, atmos`);
    return [];
  }

  try {
    const providerDir = path.join(process.cwd(), 'dist', 'providers');
    if (!fs.existsSync(providerDir)) return [];

    const files = fs.readdirSync(providerDir).filter(
      (f) => f.endsWith('.js') && !f.endsWith('.d.ts') && !f.startsWith('_')
    );

    for (const file of files) {
      if (file.startsWith('_') || file.endsWith('.json')) continue;

      const providerName = file.replace('.js', '').toLowerCase();

      // Only load configured providers
      if (!configured.includes(providerName)) {
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

  if (providers.length === 0) {
    console.log(`\n⚠️  No matching providers found.`);
    console.log(`   Configured: ${configured.join(', ')}`);
  }

  return providers;
}
