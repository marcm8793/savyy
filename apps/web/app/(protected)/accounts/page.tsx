"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
  Loader2,
  Plus,
  CreditCard,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export default function AccountsPage() {
  const searchParams = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [refreshingAccounts, setRefreshingAccounts] = useState<Set<string>>(
    new Set()
  );
  const [refreshResults, setRefreshResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  // tRPC queries and mutations
  const {
    data: accounts,
    isLoading,
    error,
    refetch,
  } = trpc.account.getAccountsFromDb.useQuery({
    limit: 50,
    offset: 0,
  });

  const { mutateAsync: connectBankAccount } =
    trpc.account.connectBankAccount.useMutation();

  const { mutateAsync: refreshCredentials } =
    trpc.transaction.refreshCredentials.useMutation();

  // Check for connection status from URL params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "true") {
      setConnectionStatus("success");
      refetch();
    } else if (error) {
      setConnectionStatus("error");
    }
  }, [searchParams, refetch]);

  const handleRefreshAccount = async (
    credentialsId: string,
    accountId: string
  ) => {
    if (!credentialsId) {
      console.error("No credentials ID available for account:", accountId);
      setRefreshResults((prev) => ({
        ...prev,
        [accountId]: {
          success: false,
          message:
            "No credentials ID available. Please reconnect your bank account.",
        },
      }));
      return;
    }

    try {
      setRefreshingAccounts((prev) => new Set(prev).add(accountId));
      setRefreshResults((prev) => {
        const newResults = { ...prev };
        delete newResults[accountId]; // Clear previous result
        return newResults;
      });

      console.log(
        "Refreshing credentials for account:",
        accountId,
        "with credentialsId:",
        credentialsId
      );

      const result = await refreshCredentials({
        credentialsId,
        force: false,
      });

      setRefreshResults((prev) => ({
        ...prev,
        [accountId]: {
          success: true,
          message: result.message || "Refresh initiated successfully!",
        },
      }));

      // Refetch accounts after a short delay to show updated data
      setTimeout(() => {
        refetch();
      }, 2000);
    } catch (error) {
      console.error("Failed to refresh account:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to refresh account data";
      setRefreshResults((prev) => ({
        ...prev,
        [accountId]: {
          success: false,
          message: errorMessage,
        },
      }));
    } finally {
      setRefreshingAccounts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
    }
  };

  const handleRefreshAllAccounts = async () => {
    if (!accounts) return;

    const accountsWithCredentials = accounts.filter(
      (account) => account.credentialsId
    );

    console.log(`Refreshing ${accountsWithCredentials.length} accounts...`);

    // Refresh all accounts in parallel
    const refreshPromises = accountsWithCredentials.map((account) =>
      handleRefreshAccount(account.credentialsId!, account.id)
    );

    await Promise.allSettled(refreshPromises);
  };

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center text-red-600">
        Failed to load accounts – please try again.
      </div>
    );
  }

  // Debug logging
  console.log("Accounts data:", accounts);
  console.log("Is loading:", isLoading);
  console.log("Accounts length:", accounts?.length);

  const handleConnectBank = async () => {
    try {
      setIsConnecting(true);

      // Call the tRPC procedure to get the secure connection URL
      const result = await connectBankAccount({
        market: "FR",
        locale: "en_US",
      });

      // Validate URL before redirect for security
      const url = new URL(result.url);
      if (
        url.hostname !== "link.tink.com" &&
        !url.hostname.endsWith(".link.tink.com")
      ) {
        throw new Error("Invalid Tink URL domain");
      }

      // Redirect to Tink with the secure URL
      window.location.href = result.url;
    } catch (error) {
      console.error("Failed to connect to Tink:", error);
      setConnectionStatus("error");
    } finally {
      setIsConnecting(false);
    }
  };

  const formatBalance = (balance: number | null, currency: string | null) => {
    if (balance === null) return "N/A";
    const amount = balance / 100; // Convert from cents
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
    }).format(amount);
  };

  const formatAccountType = (type: string | null) => {
    if (!type) return "Unknown";
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading accounts...</span>
        </div>
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
                  <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Accounts</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <ModeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Bank Accounts</h1>
              <p className="text-muted-foreground">
                Manage your connected bank accounts and view balances
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => refetch()} variant="outline">
                Refresh Accounts
              </Button>
              {accounts && accounts.length > 0 && (
                <Button
                  onClick={handleRefreshAllAccounts}
                  variant="outline"
                  disabled={refreshingAccounts.size > 0}
                >
                  {refreshingAccounts.size > 0 ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing ({refreshingAccounts.size})...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh All Data
                    </>
                  )}
                </Button>
              )}
              <Button onClick={handleConnectBank} disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Connect Bank Account
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Connection Status Alerts */}
          {connectionStatus === "success" && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Bank account connected successfully! Your accounts have been
                synced automatically.
              </AlertDescription>
            </Alert>
          )}

          {connectionStatus === "error" && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to connect bank account. Please try again or contact
                support.
              </AlertDescription>
            </Alert>
          )}

          {/* Accounts Grid */}
          {accounts && accounts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => {
                const isRefreshing = refreshingAccounts.has(account.id);
                const refreshResult = refreshResults[account.id];

                return (
                  <Card
                    key={account.id}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center">
                          <CreditCard className="mr-2 h-5 w-5" />
                          {account.accountName}
                        </CardTitle>
                        {account.accountType && (
                          <Badge variant="secondary">
                            {formatAccountType(account.accountType)}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {account.iban
                          ? `IBAN: ${account.iban}`
                          : `ID: ${account.tinkAccountId}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Balance:
                          </span>
                          <span className="font-semibold text-lg">
                            {formatBalance(account.balance, account.currency)}
                          </span>
                        </div>
                        {account.tinkAccountId && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Source:
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Tink Connected
                            </Badge>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Last Updated:
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(account.updatedAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Refresh Button */}
                        {account.credentialsId && (
                          <div className="pt-2 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleRefreshAccount(
                                  account.credentialsId!,
                                  account.id
                                )
                              }
                              disabled={isRefreshing}
                              className="w-full"
                            >
                              {isRefreshing ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Refreshing...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Refresh Data
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {/* Refresh Result Alert */}
                        {refreshResult && (
                          <Alert
                            className={`${
                              refreshResult.success
                                ? "border-green-200 bg-green-50"
                                : "border-red-200 bg-red-50"
                            }`}
                          >
                            {refreshResult.success ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                            <AlertDescription
                              className={
                                refreshResult.success
                                  ? "text-green-800"
                                  : "text-red-800"
                              }
                            >
                              {refreshResult.message}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No accounts connected
                </h3>
                <p className="text-muted-foreground mb-6">
                  Connect your bank account to start tracking your finances
                </p>
                <Button onClick={handleConnectBank} disabled={isConnecting}>
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Connect Your First Account
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
