"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Wallet,
  CreditCard,
} from "lucide-react";
import { formatSimpleAmount } from "@/lib/utils";
import { useLocaleContext } from "@/providers/locale-provider";

interface StatsCardsProps {
  totalWealth: number;
  totalIncome: number;
  totalExpenses: number;
  averageDailySpending: number;
  accountCount: number;
  isLoading: boolean;
}

export function StatsCards({
  totalWealth,
  totalIncome,
  totalExpenses,
  averageDailySpending,
  accountCount,
  isLoading,
}: StatsCardsProps) {
  const { locale } = useLocaleContext();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Wealth</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading
              ? "..."
              : formatSimpleAmount(totalWealth, "EUR", locale)}
          </div>
          <p className="text-xs text-muted-foreground">
            <TrendingUp className="inline h-3 w-3 mr-1" />
            Across {accountCount} accounts
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Income</CardTitle>
          <ArrowUpRight className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading
              ? "..."
              : formatSimpleAmount(totalIncome, "EUR", locale)}
          </div>
          <p className="text-xs text-muted-foreground">Last 3 months</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
          <ArrowDownRight className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading
              ? "..."
              : formatSimpleAmount(totalExpenses, "EUR", locale)}
          </div>
          <p className="text-xs text-muted-foreground">Last 3 months</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? "..." : formatSimpleAmount(averageDailySpending, "EUR", locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <p className="text-xs text-muted-foreground">
            Daily spending average
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
