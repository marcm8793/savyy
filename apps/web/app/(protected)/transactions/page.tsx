"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Calendar,
  TrendingUp,
  TrendingDown,
  Filter,
  RefreshCw,
  CreditCard,
  Building,
  Download,
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
import { CategoryCombobox } from "@/components/transactions/category-combobox";
import { TransactionDetailSheet } from "@/components/transactions/transaction-detail-sheet";
import { formatAmount, formatSimpleAmount } from "@/lib/utils";
import { useLocaleContext } from "@/providers/locale-provider";

// Use the transaction type but with serialized dates (as they come from tRPC)
type Transaction = {
  id: string;
  tinkTransactionId: string;
  tinkAccountId: string;
  amount: string;
  amountScale: number | null;
  currencyCode: string;
  bookedDate: string | null;
  transactionDate: string | null;
  valueDate: string | null;
  displayDescription: string | null;
  originalDescription: string | null;
  status: string;
  transactionType: string | null;

  // Original Tink categories (preserved)
  categoryName: string | null;
  categoryId: string | null;

  // Enhanced categorization fields
  mainCategory: string | null;
  subCategory: string | null;
  categorySource: string | null;
  categoryConfidence: string | null;
  needsReview: boolean | null;
  categorizedAt: string | null;

  merchantName: string | null;
  merchantCategoryCode: string | null;
  reference: string | null;
  payeeName: string | null;
  payerName: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function TransactionsPage() {
  const { locale } = useLocaleContext();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Get date range for selected month
  const dateRange = useMemo(() => {
    const date = parseISO(selectedMonth + "-01");
    return {
      from: format(startOfMonth(date), "yyyy-MM-dd"),
      to: format(endOfMonth(date), "yyyy-MM-dd"),
    };
  }, [selectedMonth]);

  // Fetch accounts for filtering
  const { data: accounts } = trpc.account.getAccountsFromDb.useQuery({
    limit: 100,
    offset: 0,
  });

  // Fetch transactions for selected month
  const {
    data: transactionsData,
    isLoading,
    error,
    refetch,
  } = trpc.transaction.list.useQuery({
    bookedDateGte: dateRange.from,
    bookedDateLte: dateRange.to,
    accountIdIn: selectedAccount === "all" ? undefined : [selectedAccount],
    statusIn:
      selectedStatus === "all"
        ? undefined
        : [selectedStatus as "BOOKED" | "PENDING" | "UNDEFINED"],
    pageSize: 100,
  });

  // Get transaction statistics
  const { data: stats } = trpc.transaction.stats.useQuery({
    accountIds: selectedAccount === "all" ? undefined : [selectedAccount],
    dateRange,
  });

  const transactions = transactionsData?.transactions || [];

  // Generate month options for the last 2 years
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy"),
      });
    }
    return options;
  }, []);


  // Get account name helper
  const getAccountName = (tinkAccountId: string) => {
    const account = accounts?.find(
      (acc) => acc.tinkAccountId === tinkAccountId
    );
    return account?.accountName || tinkAccountId;
  };

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach((transaction) => {
      const date =
        transaction.bookedDate ||
        transaction.transactionDate ||
        format(parseISO(transaction.createdAt), "yyyy-MM-dd");
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
    });

    // Sort dates descending
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const sortedGroups: Record<string, Transaction[]> = {};
    sortedDates.forEach((date) => {
      sortedGroups[date] = groups[date].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return sortedGroups;
  }, [transactions]);

  // Handle mobile transaction click
  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsSheetOpen(true);
  };

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center text-red-600">
        Failed to load transactions – please try again.
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Transactions</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <ModeToggle />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Transactions</h1>
              <p className="text-muted-foreground">
                View and analyze your transaction history
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/transactions/export">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>
              </Link>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Month</label>
                  <Select
                    value={selectedMonth}
                    onValueChange={setSelectedMonth}
                  >
                    <SelectTrigger>
                      <Calendar className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Account</label>
                  <Select
                    value={selectedAccount}
                    onValueChange={setSelectedAccount}
                  >
                    <SelectTrigger>
                      <Building className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {accounts?.map((account) => (
                        <SelectItem
                          key={account.id}
                          value={account.tinkAccountId}
                        >
                          {account.accountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={selectedStatus}
                    onValueChange={setSelectedStatus}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="BOOKED">Booked</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="UNDEFINED">Undefined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Income
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatSimpleAmount(stats.totalIncome, "EUR", locale)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Expenses
                  </CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatSimpleAmount(stats.totalExpenses, "EUR", locale)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Net Amount
                  </CardTitle>
                  <CreditCard className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${
                      stats.netAmount >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatSimpleAmount(stats.netAmount, "EUR", locale)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Transactions */}
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mr-2" />
                <span>Loading transactions...</span>
              </CardContent>
            </Card>
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  No transactions found for the selected filters.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedTransactions).map(
                ([date, dayTransactions]) => (
                  <Card key={date}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {format(parseISO(date), "EEEE, MMMM d, yyyy")}
                      </CardTitle>
                      <CardDescription>
                        {dayTransactions.length} transaction
                        {dayTransactions.length !== 1 ? "s" : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Account
                              </TableHead>
                              <TableHead className="hidden md:table-cell">
                                Category
                              </TableHead>
                              <TableHead className="hidden lg:table-cell">
                                Merchant
                              </TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">
                                Amount
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dayTransactions.map((transaction) => {
                              const amount = parseFloat(transaction.amount);
                              const scaledAmount =
                                amount /
                                Math.pow(10, transaction.amountScale || 0);
                              const isIncome = scaledAmount > 0;

                              return (
                                <TableRow
                                  key={transaction.id}
                                  className="md:cursor-default cursor-pointer md:hover:bg-transparent hover:bg-muted/50"
                                  onClick={() =>
                                    handleTransactionClick(transaction)
                                  }
                                >
                                  <TableCell>
                                    <div className="space-y-1">
                                      <div className="font-medium">
                                        {transaction.displayDescription ||
                                          transaction.originalDescription ||
                                          "No description"}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {transaction.reference &&
                                          `Ref: ${transaction.reference}`}
                                      </div>
                                      {/* Mobile category indicator */}
                                      <div className="md:hidden flex gap-1 mt-1">
                                        {transaction.mainCategory &&
                                        transaction.subCategory ? (
                                          <>
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {transaction.mainCategory}
                                            </Badge>
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {transaction.subCategory}
                                            </Badge>
                                          </>
                                        ) : transaction.categoryName ? (
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            {transaction.categoryName}
                                          </Badge>
                                        ) : (
                                          <span
                                            className="text-xs text-muted-foreground"
                                            aria-label="Transaction not categorized, tap to categorize"
                                          >
                                            Tap to categorize
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <div className="text-sm">
                                      {getAccountName(
                                        transaction.tinkAccountId
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className="hidden md:table-cell whitespace-normal"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <CategoryCombobox
                                      transactionId={transaction.id}
                                      currentMainCategory={
                                        transaction.mainCategory
                                      }
                                      currentSubCategory={
                                        transaction.subCategory
                                      }
                                      onCategoryChange={() => {
                                        // Refetch data to update the table
                                        refetch();
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="hidden lg:table-cell">
                                    <div className="text-sm">
                                      {transaction.merchantName ||
                                        transaction.payeeName ||
                                        transaction.payerName ||
                                        "-"}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        transaction.status === "BOOKED"
                                          ? "default"
                                          : transaction.status === "PENDING"
                                          ? "secondary"
                                          : "outline"
                                      }
                                    >
                                      {transaction.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div
                                      className={`font-medium ${
                                        isIncome
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {formatAmount(
                                        transaction.amount,
                                        transaction.amountScale,
                                        transaction.currencyCode,
                                        locale
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          )}
        </div>

        {/* Mobile Transaction Detail Sheet */}
        <TransactionDetailSheet
          transaction={selectedTransaction}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          onCategoryChange={() => {
            // Refetch data to update the table
            refetch();
          }}
          getAccountName={getAccountName}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
