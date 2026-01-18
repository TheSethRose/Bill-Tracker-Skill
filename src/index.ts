/**
 * Bill Tracker Skill - Main CLI Entry Point
 * 
 * A unified dashboard for tracking bills across multiple providers.
 * Built for Clawdbot - other skill agents can import and use this module.
 * 
 * @ clawd.bot - Thank you for making this possible!
 */

import 'dotenv/config';
import { Aggregator, loadProviders } from './aggregator.js';
import { UI } from './ui.js';

// Parse command line args
const args = process.argv.slice(2);
const providerArg = args.find(arg => arg.startsWith('--provider='));
const forceArg = args.find(arg => arg === '--force');

// Set config from CLI args
if (providerArg) {
  const provider = providerArg.split('=')[1];
  process.env.BILL_PROVIDERS = provider;
  console.log(`\n🔧 Running single provider: ${provider}\n`);
}

if (forceArg) {
  process.env.BILL_FORCE_FETCH = 'true';
  console.log(`\n🔄 Force fetching fresh data (ignoring cache)\n`);
}

export async function main() {
  const providers = await loadProviders();
  if (providers.length === 0) {
    console.log('\nNo providers loaded. Add providers to BILL_PROVIDERS in .env\n');
    return;
  }
  
  const aggregator = new Aggregator(providers);
  const bills = await aggregator.fetchAllBills();
  const dashboard = new UI(bills);
  dashboard.render();
  
  console.log('\n💾 Data cached in data/ directory');
}

// Export for use by other Clawdbot skills
export { Aggregator } from './aggregator.js';
export { UI } from './ui.js';
export type { Bill, Provider } from './provider.js';
