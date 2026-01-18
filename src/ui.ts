/**
 * Dashboard UI
 * 
 * Formats and displays bill data in a clean table format.
 */

import { Bill, ProviderCategory } from './provider.js';
import { format } from 'date-fns';
import { table, TableUserConfig } from 'table';

export class UI {
  constructor(private bills: Bill[]) {}

  render(): void {
    if (this.bills.length === 0) {
      console.log('📭 No bills found. Add providers to get started!');
      return;
    }

    console.log(this.buildSummary());
    console.log('\n' + this.buildTable());
    console.log('\n' + this.buildLegend());
  }

  private buildSummary(): string {
    const totalDue = this.bills.reduce((sum, b) => {
      if (b.status !== 'paid') return sum + b.amount;
      return sum;
    }, 0);

    const overdue = this.bills.filter((b) => b.status === 'overdue').length;
    const dueSoon = this.bills.filter((b) => b.status === 'due').length;
    const pending = this.bills.filter((b) => b.status === 'pending').length;

    return `
╔══════════════════════════════════════════════════════════╗
║                    💸 BILL TRACKER                       ║
╠══════════════════════════════════════════════════════════╣
║  Total Due:     $${totalDue.toFixed(2).padStart(12)}                       ║
║  Overdue:       ${overdue.toString().padStart(12)} ⚠️                       ║
║  Due Soon:      ${dueSoon.toString().padStart(12)} 🔔                       ║
║  Pending:       ${pending.toString().padStart(12)} 📅                       ║
╚══════════════════════════════════════════════════════════╝`;
  }

  private buildTable(): string {
    const header = ['Provider', 'Amount', 'Due Date', 'Status', 'Category'];
    const rows = this.bills.map((bill) => [
      bill.provider,
      this.formatCurrency(bill.amount, bill.currency),
      format(bill.dueDate, 'MMM dd'),
      this.formatStatus(bill.status),
      bill.category,
    ]);

    const config: TableUserConfig = {
      columnDefault: { alignment: 'left' },
      columns: {
        1: { alignment: 'right' as const },
        2: { alignment: 'center' as const },
        3: { alignment: 'center' as const },
      },
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
      },
    };

    return table([header, ...rows], config);
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }

  private formatStatus(status: Bill['status']): string {
    const icons: Record<Bill['status'], string> = {
      overdue: '🔴 OVERDUE',
      due: '🟡 DUE SOON',
      pending: '🟢 PENDING',
      paid: '✅ PAID',
    };
    return icons[status];
  }

  private buildLegend(): string {
    return `Legend: 🔴 Overdue (past due)  🟡 Due Soon (within 7 days)  🟢 Pending  ✅ Paid`;
  }

  exportToJSON(): string {
    return JSON.stringify(this.bills, null, 2);
  }

  exportToCSV(): string {
    const header = 'Provider,Amount,Currency,Due Date,Status,Category\n';
    const rows = this.bills.map((b) =>
      `${b.provider},${b.amount},${b.currency},${b.dueDate.toISOString()},${b.status},${b.category}`
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
