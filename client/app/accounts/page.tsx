"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AccountsPage() {
  const searchParams = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  // tRPC queries and mutations
  const {
    data: accounts,
    isLoading,
    refetch,
  } = trpc.account.getAccounts.useQuery({
    limit: 50,
    offset: 0,
  });

  // Debug logging
  console.log("Accounts data:", accounts);
  console.log("Is loading:", isLoading);
  console.log("Accounts length:", accounts?.length);

  const { mutateAsync: syncAccounts } =
    trpc.account.syncTinkAccounts.useMutation();
  const { mutateAsync: getTinkConnectionUrl } =
    trpc.account.getTinkConnectionUrlSecure.useMutation();

  const handleSyncAccounts = useCallback(
    async (authCode: string) => {
      try {
        const result = await syncAccounts({ code: authCode });
        console.log("Accounts synced successfully:", result);
        // Refresh the accounts list
        refetch();
        // Clear the code from URL
        window.history.replaceState({}, "", "/accounts?connected=true");
      } catch (error) {
        console.error("Failed to sync accounts:", error);
        setConnectionStatus("error");
      }
    },
    [syncAccounts, refetch]
  );

  // Check for connection status from URL params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "true") {
      setConnectionStatus("success");
    } else if (error) {
      setConnectionStatus("error");
    }
  }, [searchParams]);

  const handleConnectBank = async () => {
    try {
      setIsConnecting(true);

      // Call the tRPC procedure to get the secure connection URL
      const result = await getTinkConnectionUrl({
        market: "FR",
        locale: "en_US",
      });

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
    <div className="container mx-auto py-8">
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
            Bank account connected successfully! Your accounts have been synced
            automatically.
          </AlertDescription>
        </Alert>
      )}

      {connectionStatus === "error" && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Failed to connect bank account. Please try again or contact support.
          </AlertDescription>
        </Alert>
      )}

      {/* Accounts Grid */}
      {accounts && accounts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
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
                    : `ID: ${account.bankId}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
                </div>
              </CardContent>
            </Card>
          ))}
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
  );
}
