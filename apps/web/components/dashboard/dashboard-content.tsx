"use client";

import React from "react";
import { trpc } from "@/lib/trpc";
import { StatsCards } from "./stats-cards";
import { MonthlySpendingChart } from "./monthly-spending-chart";
import { AccountDistributionChart } from "./account-distribution-chart";
import { CategoryBreakdown } from "./category-breakdown";
import { QuickActions } from "./quick-actions";

export function DashboardContent() {
  const { data: accounts, isLoading: accountsLoading } =
    trpc.account.getAccountsFromDb.useQuery({
      limit: 100,
      offset: 0,
    });

  // Get transaction statistics for the last 3 months
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: transactionStats, isLoading: statsLoading } =
    trpc.transaction.stats.useQuery({
      dateRange: {
        from: threeMonthsAgo.toISOString().split("T")[0],
        to: new Date().toISOString().split("T")[0],
      },
    });

  // Get recent transactions for spending pattern (last 3 months)
  const { data: recentTransactions } = trpc.transaction.list.useQuery({
    pageSize: 100,
    bookedDateGte: threeMonthsAgo.toISOString().split("T")[0],
  });

  // Calculate total wealth (balance is stored as cents, divide by 100 to get actual amount)
  const totalWealth =
    accounts?.reduce((sum, account) => {
      // Balance in database is stored as cents (multiplied by 100), so divide by 100
      const balance = account.balance ? Number(account.balance) / 100 : 0;
      return sum + balance;
    }, 0) || 0;

  // Create monthly spending data from recent transactions
  const monthlySpendingData = React.useMemo(() => {
    if (!recentTransactions?.transactions) return [];

    const monthlyData: { [key: string]: { amount: number; date: Date } } = {};
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    recentTransactions.transactions.forEach((transaction) => {
      const date = new Date(transaction.bookedDate);
      const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
      const amount = transaction.amount
        ? Number(transaction.amount) /
          Math.pow(10, transaction.amountScale || 0)
        : 0;

      if (amount < 0) {
        // Only expenses (negative amounts)
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            amount: 0,
            date: new Date(date.getFullYear(), date.getMonth(), 1),
          };
        }
        monthlyData[monthKey].amount += Math.abs(amount);
      }
    });

    // Sort by date (oldest to newest) and take last 3 months
    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        spending: data.amount,
        date: data.date,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime()) // Sort chronologically
      .slice(-3) // Take last 3 months
      .map(({ month, spending }) => ({ month, spending })); // Remove date from final output
  }, [recentTransactions]);

  // Create account distribution data
  const accountDistributionData =
    accounts
      ?.map((account, index) => {
        // Balance in database is stored as cents (multiplied by 100), so divide by 100
        const balance = account.balance ? Number(account.balance) / 100 : 0;
        return {
          name: account.accountName || `Account ${index + 1}`,
          value: Math.abs(balance),
          color: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
        };
      })
      .filter((account) => account.value > 0) || [];

  const chartConfig = {
    spending: {
      label: "Monthly Spending",
      color: "hsl(var(--chart-1))",
    },
    ...accountDistributionData.reduce((acc, account) => {
      // Truncate long account names for legend display
      const displayName =
        account.name.length > 15
          ? `${account.name.substring(0, 15)}...`
          : account.name;

      acc[account.name] = {
        label: displayName,
        color: account.color,
      };
      return acc;
    }, {} as Record<string, { label: string; color: string }>),
  };

  // Calculate derived metrics
  const totalExpenses = transactionStats?.totalExpenses || 0;
  const totalIncome = transactionStats?.totalIncome || 0;
  // Calculate actual days between the date range
  const actualDays = Math.max(
    1,
    Math.ceil(
      (new Date().getTime() - threeMonthsAgo.getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const averageDailySpending = totalExpenses / actualDays;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <StatsCards
        totalWealth={totalWealth}
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        averageDailySpending={averageDailySpending}
        accountCount={accounts?.length || 0}
        isLoading={accountsLoading || statsLoading}
      />

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <MonthlySpendingChart data={monthlySpendingData} />
        <AccountDistributionChart
          data={accountDistributionData}
          chartConfig={chartConfig}
        />
      </div>

      {/* Category Breakdown */}
      {transactionStats?.categoryBreakdown && (
        <CategoryBreakdown
          categoryBreakdown={transactionStats.categoryBreakdown}
          totalExpenses={totalExpenses}
        />
      )}

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}
