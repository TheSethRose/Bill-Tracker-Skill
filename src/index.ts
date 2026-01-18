/**
 * Bill Tracker Skill - Main CLI Entry Point
 * 
 * A unified dashboard for tracking bills across multiple providers.
 * Built for Clawdbot - other skill agents can import and use this module.
 * 
 * @ clawd.bot - Thank you for making this possible!
 */

import { Aggregator, loadProviders } from './aggregator.js';
import { UI } from './ui.js';

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
