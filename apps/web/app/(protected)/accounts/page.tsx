"use client";

import { useState, useEffect, useRef } from "react";
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
import { formatBalance, getExpiryStatus } from "@/lib/utils";
import { useLocaleContext } from "@/providers/locale-provider";
import Link from "next/link";

export default function AccountsPage() {
  const searchParams = useSearchParams();
  const { locale, market } = useLocaleContext();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [refreshingAccounts, setRefreshingAccounts] = useState<Set<string>>(
    new Set()
  );
  const [refreshResults, setRefreshResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  const timeoutIds = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    return () => {
      timeoutIds.current.forEach(clearTimeout);
      timeoutIds.current = [];
    };
  }, []);

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

  const { data: providerConsents, refetch: refetchConsents } =
    trpc.providerConsent.list.useQuery(
      {},
      {
        enabled: !!accounts?.length && connectionStatus !== "error",
        retry: false, // Don't retry failed consent checks automatically
      }
    );


  const { mutateAsync: reconnectBankAccount } =
    trpc.account.reconnectBankAccount.useMutation();

  const { mutateAsync: refreshCredentials } =
    trpc.transaction.refreshCredentials.useMutation();

  const { mutateAsync: getUpdateConsentUrl } =
    trpc.providerConsent.getUpdateConsentUrl.useMutation();

  // Check for connection status from URL params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "true") {
      setConnectionStatus("success");
      // Add a small delay to ensure backend has processed the token update
      const refetchTimeout = setTimeout(() => {
        refetch(); // Refetch accounts data
        refetchConsents(); // Refetch consent data to get updated status
      }, 1000);
      timeoutIds.current.push(refetchTimeout);

      // Clear the success status after 5 seconds to show actual status
      const clearStatusTimeout = setTimeout(() => {
        setConnectionStatus(null);
      }, 5000);
      timeoutIds.current.push(clearStatusTimeout);
    } else if (error) {
      setConnectionStatus("error");
    }
  }, [searchParams, refetch, refetchConsents]);

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
      const refetchDelayTimeout = setTimeout(() => {
        refetch();
      }, 2000);
      timeoutIds.current.push(refetchDelayTimeout);
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

  const handleUpdateConsent = async (credentialsId: string) => {
    try {
      const result = await getUpdateConsentUrl({
        credentialsId,
        market,
        locale: locale.replace("-", "_"),
      });

      // Validate URL before redirect for security
      const url = new URL(result.url);
      if (
        url.hostname !== "link.tink.com" &&
        !url.hostname.endsWith(".link.tink.com")
      ) {
        throw new Error("Invalid Tink URL domain");
      }

      // Redirect to Tink's consent update flow
      window.location.href = result.url;
    } catch (error) {
      console.error("Failed to get consent update URL:", error);
      setConnectionStatus("error");
    }
  };

  const getConsentStatus = (credentialsId: string) => {
    if (!providerConsents?.consents) return null;

    return providerConsents.consents.find(
      (consent) => consent.credentialsId === credentialsId
    );
  };

  const getConsentStatusBadge = (credentialsId: string) => {
    // Check if we need reconnection first
    if (providerConsents?.needsReconnection) {
      return <Badge variant="destructive">Reconnection Required</Badge>;
    }

    // If we just connected successfully, show positive status briefly
    if (connectionStatus === "success") {
      return <Badge variant="default">Recently Connected</Badge>;
    }

    // Check if we have an account with expired token
    const account = accounts?.find(
      (acc) => acc.credentialsId === credentialsId
    );
    if (
      account?.tokenExpiresAt &&
      new Date(account.tokenExpiresAt) <= new Date()
    ) {
      return <Badge variant="destructive">Session Expired</Badge>;
    }

    const consent = getConsentStatus(credentialsId);

    if (!consent) {
      // If we don't have consent data but have a valid token, show checking status
      if (
        account?.accessToken &&
        account?.tokenExpiresAt &&
        new Date(account.tokenExpiresAt) > new Date()
      ) {
        return <Badge variant="outline">Checking...</Badge>;
      }
      return <Badge variant="secondary">Unknown</Badge>;
    }

    if (consent.needsUpdate) {
      return <Badge variant="destructive">Needs Update</Badge>;
    }

    if (consent.status === "UPDATED") {
      return <Badge variant="default">Active</Badge>;
    }

    return <Badge variant="secondary">{consent.status}</Badge>;
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


  const handleReconnectAccount = async () => {
    try {
      setIsConnecting(true);

      // Call the specific reconnect procedure for expired sessions
      const result = await reconnectBankAccount({
        market,
        locale: locale.replace("-", "_"),
      });

      // Validate URL before redirect for security
      const url = new URL(result.url);
      if (
        url.hostname !== "link.tink.com" &&
        !url.hostname.endsWith(".link.tink.com")
      ) {
        throw new Error("Invalid Tink URL domain");
      }

      // Redirect to Tink's reconnection flow
      window.location.href = result.url;
    } catch (error) {
      console.error("Failed to reconnect bank account:", error);
      setConnectionStatus("error");
    } finally {
      setIsConnecting(false);
    }
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
              <Link href="/accounts/connect">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Bank Account
                </Button>
              </Link>
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

          {/* Reconnection Needed Alert */}
          {providerConsents?.needsReconnection && (
            <Alert className="mb-6 border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Bank reconnection required:</strong>{" "}
                {"message" in providerConsents
                  ? providerConsents.message
                  : "Your bank session has expired. Please reconnect your accounts to continue accessing your financial data."}
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
                            {formatBalance(account.balance, account.currency, locale)}
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

                        {/* Session Expiry Information */}
                        {account.consentExpiresAt && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Session Expires:
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {(() => {
                                const status = getExpiryStatus(account.consentExpiresAt, locale);
                                return <span className={status.className}>{status.text}</span>;
                              })()}
                            </span>
                          </div>
                        )}

                        {/* Consent Status */}
                        {account.credentialsId && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Connection Status:
                            </span>
                            {getConsentStatusBadge(account.credentialsId)}
                          </div>
                        )}

                        {/* Action Buttons */}
                        {account.credentialsId && (
                          <div className="pt-2 border-t space-y-2">
                            {/* Show different buttons based on consent status */}
                            {(() => {
                              // If we need reconnection, show reconnect button
                              if (providerConsents?.needsReconnection) {
                                return (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleReconnectAccount}
                                    disabled={isConnecting}
                                    className="w-full"
                                  >
                                    {isConnecting ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Connecting...
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle className="mr-2 h-4 w-4" />
                                        Reconnect Account
                                      </>
                                    )}
                                  </Button>
                                );
                              }

                              // Check individual consent status
                              const consent = getConsentStatus(
                                account.credentialsId!
                              );
                              return consent?.needsUpdate ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleUpdateConsent(account.credentialsId!)
                                  }
                                  className="w-full"
                                >
                                  <AlertCircle className="mr-2 h-4 w-4" />
                                  Update Connection
                                </Button>
                              ) : (
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
                              );
                            })()}
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
                <Link href="/accounts/connect">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Connect Your First Account
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
