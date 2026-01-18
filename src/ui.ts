/**
 * Dashboard UI - Simple text output
 */

import { Bill, ProviderCategory } from './provider.js';
import { format } from 'date-fns';

export class UI {
  constructor(private bills: Bill[]) {}

  render(): void {
    if (this.bills.length === 0) {
      console.log('No bills found. Add providers to get started!');
      return;
    }

    // Calculate totals
    const totalDue = this.bills.reduce((sum, b) => {
      if (b.status !== 'paid') return sum + b.amount;
      return sum;
    }, 0);

    console.log(`\n=== BILL SUMMARY ===`);
    console.log(`Total Due: $${totalDue.toFixed(2)}`);
    console.log(`Bills: ${this.bills.length}\n`);

    // Output each bill as simple text
    for (const bill of this.bills) {
      console.log(`--- ${bill.provider} ---`);
      console.log(`  Account: ****${bill.accountLast4 || 'N/A'}`);
      console.log(`  Amount: $${bill.amount.toFixed(2)} ${bill.currency}`);
      console.log(`  Due Date: ${format(bill.dueDate, 'MMM dd, yyyy')}`);
      console.log(`  Status: ${bill.status}`);
      console.log(`  Category: ${bill.category}`);
      if (bill.payUrl) {
        console.log(`  Pay URL: ${bill.payUrl}`);
      }
      console.log('');
    }
  }

  exportToJSON(): string {
    return JSON.stringify(this.bills, null, 2);
  }

  exportToCSV(): string {
    const header = 'Provider,Amount,Currency,Due Date,Status,Category,AccountLast4\n';
    const rows = this.bills.map((b) =>
      `${b.provider},${b.amount},${b.currency},${b.dueDate.toISOString()},${b.status},${b.category},${b.accountLast4 || ''}`
    ).join('\n');
    return header + rows;
  }
}

export function groupByCategory(bills: Bill[]): Record<ProviderCategory, Bill[]> {
  return bills.reduce((acc, bill) => {
    if (!acc[bill.category]) acc[bill.category] = [];
    acc[bill.category].push(bill);
    return acc;
  }, {} as Record<ProviderCategory, Bill[]>);
}
