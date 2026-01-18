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
const specificProvider = providerArg ? providerArg.split('=')[1] : null;

// Override BILL_PROVIDERS if --provider is specified
if (specificProvider) {
  process.env.BILL_PROVIDERS = specificProvider;
  console.log(`\n🔧 Running single provider: ${specificProvider}\n`);
}

export async function main() {
  const providers = await loadProviders();
  const aggregator = new Aggregator(providers);
  const bills = await aggregator.fetchAllBills();
  const dashboard = new UI(bills);
  dashboard.render();
}

// Export for use by other Clawdbot skills
export { Aggregator } from './aggregator.js';
export { UI } from './ui.js';
export type { Bill, Provider } from './provider.js';
