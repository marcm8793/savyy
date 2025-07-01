"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, TrendingUp, PieChartIcon, CreditCard } from "lucide-react";
import Link from "next/link";

export function QuickActions() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Link href="/accounts" className="group">
        <Card className="transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Accounts
              <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
            <CardDescription>
              Manage your bank accounts and view balances
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>

      <Link href="/transactions" className="group">
        <Card className="transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Transactions
              <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
            <CardDescription>
              View your transaction history and spending patterns
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>

      <Link href="/transactions/categories" className="group">
        <Card className="transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Analytics
              <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
            <CardDescription>
              Track your spending patterns and categories
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  );
}