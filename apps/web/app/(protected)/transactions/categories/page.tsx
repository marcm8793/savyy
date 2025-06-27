"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  PieChart,
  TrendingUp,
  Eye,
  AlertTriangle,
} from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ModeToggle } from "@/components/themes/mode-toggle";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

export default function CategoriesPage() {
  const [selectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  // Get date range for selected month
  const dateRange = useMemo(() => {
    const date = parseISO(selectedMonth + "-01");
    return {
      from: format(startOfMonth(date), "yyyy-MM-dd"),
      to: format(endOfMonth(date), "yyyy-MM-dd"),
    };
  }, [selectedMonth]);

  // Fetch transaction statistics with category breakdown
  const { data: stats, isLoading } = trpc.transaction.stats.useQuery({
    dateRange,
  });

  // Fetch recent transactions that need review
  const { data: reviewTransactions } = trpc.transaction.list.useQuery({
    bookedDateGte: dateRange.from,
    bookedDateLte: dateRange.to,
    pageSize: 50,
  });

  // Filter transactions that need review
  const transactionsNeedingReview = useMemo(() => {
    if (!reviewTransactions?.transactions) return [];
    return reviewTransactions.transactions.filter(
      (t) => t.needsReview || (!t.mainCategory && !t.categoryName)
    );
  }, [reviewTransactions]);

  // Calculate categorization metrics
  const categorizationMetrics = useMemo(() => {
    if (!reviewTransactions?.transactions) return null;

    const total = reviewTransactions.transactions.length;
    const categorized = reviewTransactions.transactions.filter(
      (t) => t.mainCategory || t.categoryName
    ).length;
    const needsReview = transactionsNeedingReview.length;
    const automated = reviewTransactions.transactions.filter(
      (t) => t.mainCategory && t.categorySource !== "user"
    ).length;

    return {
      total,
      categorized,
      needsReview,
      automated,
      accuracy: total > 0 ? Math.round((categorized / total) * 100) : 0,
      automation: total > 0 ? Math.round((automated / total) * 100) : 0,
    };
  }, [reviewTransactions, transactionsNeedingReview]);

  // Convert category breakdown to array for display
  const categoryData = useMemo(() => {
    if (!stats?.categoryBreakdown) return [];

    return Object.entries(stats.categoryBreakdown)
      .map(([category, data]) => ({
        category,
        count: data.count,
        amount: data.amount,
        percentage:
          stats.totalTransactions > 0
            ? Math.round((data.count / stats.totalTransactions) * 100)
            : 0,
      }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [stats]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(Math.abs(amount));
  };

  const getConfidenceColor = (confidence: string | null) => {
    if (!confidence) return "text-gray-500";
    const conf = parseFloat(confidence);
    if (conf >= 0.9) return "text-green-600";
    if (conf >= 0.7) return "text-yellow-600";
    return "text-red-600";
  };

  const getSourceBadgeVariant = (source: string | null) => {
    switch (source) {
      case "user":
        return "default";
      case "tink":
        return "secondary";
      case "mcc":
        return "outline";
      case "merchant":
        return "outline";
      case "description":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/transactions">
                  Transactions
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Categories</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center space-x-4">
            <ModeToggle />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Transaction Categories
              </h1>
              <p className="text-muted-foreground">
                View and manage how your transactions are categorized
              </p>
            </div>
          </div>

          {/* Categorization Metrics */}
          {categorizationMetrics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Categorization Accuracy
                  </CardTitle>
                  <PieChart className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {categorizationMetrics.accuracy}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {categorizationMetrics.categorized} of{" "}
                    {categorizationMetrics.total} transactions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Automation Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {categorizationMetrics.automation}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {categorizationMetrics.automated} automatically categorized
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Needs Review
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {categorizationMetrics.needsReview}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Transactions requiring attention
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Transactions
                  </CardTitle>
                  <Eye className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {categorizationMetrics.total}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    For {format(parseISO(selectedMonth + "-01"), "MMMM yyyy")}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Category Breakdown */}
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mr-2" />
                <span>Loading category data...</span>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
                <CardDescription>
                  Spending distribution across categories for{" "}
                  {format(parseISO(selectedMonth + "-01"), "MMMM yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryData.map((item) => (
                        <TableRow key={item.category}>
                          <TableCell>
                            <div className="font-medium">{item.category}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.count}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                item.amount < 0
                                  ? "text-red-600"
                                  : "text-green-600"
                              }
                            >
                              {formatAmount(item.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.percentage}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transactions Needing Review */}
          {transactionsNeedingReview.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Transactions Needing Review
                </CardTitle>
                <CardDescription>
                  These transactions need manual categorization or review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Current Category</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionsNeedingReview
                        .slice(0, 10)
                        .map((transaction) => {
                          const amount = parseFloat(transaction.amount);
                          const scaledAmount =
                            amount / Math.pow(10, transaction.amountScale || 0);

                          return (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                <div className="font-medium">
                                  {transaction.displayDescription ||
                                    transaction.originalDescription ||
                                    "No description"}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {transaction.merchantName ||
                                    transaction.payeeName ||
                                    transaction.payerName}
                                </div>
                              </TableCell>
                              <TableCell>
                                {transaction.mainCategory &&
                                transaction.subCategory ? (
                                  <div className="flex flex-col gap-1">
                                    <Badge
                                      variant="default"
                                      className="text-xs"
                                    >
                                      {transaction.mainCategory}
                                    </Badge>
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {transaction.subCategory}
                                    </Badge>
                                  </div>
                                ) : transaction.categoryName ? (
                                  <Badge variant="secondary">
                                    {transaction.categoryName}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">
                                    Uncategorized
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {transaction.categorySource && (
                                  <Badge
                                    variant={getSourceBadgeVariant(
                                      transaction.categorySource
                                    )}
                                  >
                                    {transaction.categorySource}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {transaction.categoryConfidence && (
                                  <span
                                    className={getConfidenceColor(
                                      transaction.categoryConfidence
                                    )}
                                  >
                                    {Math.round(
                                      parseFloat(
                                        transaction.categoryConfidence
                                      ) * 100
                                    )}
                                    %
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={
                                    scaledAmount < 0
                                      ? "text-red-600"
                                      : "text-green-600"
                                  }
                                >
                                  {formatAmount(scaledAmount)}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
                {transactionsNeedingReview.length > 10 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline">
                      View All {transactionsNeedingReview.length} Transactions
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
