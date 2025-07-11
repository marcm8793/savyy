"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ArrowLeft, Globe, Check } from "lucide-react";
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
import { useLocaleContext } from "@/providers/locale-provider";
import Link from "next/link";
import { TINK_MARKETS, type TinkMarketCode, type TinkLocale, isTinkLocale } from "@/lib/tink-markets";


export default function ConnectAccountPage() {
  const { locale, market } = useLocaleContext();
  
  // Get initial market based on user's locale context, fallback to France
  const getInitialMarket = () => {
    if (market && TINK_MARKETS.find(m => m.code === market)) {
      return market;
    }
    // Try to match based on locale
    const localeCountry = locale.split('-')[1]?.toUpperCase();
    if (localeCountry && TINK_MARKETS.find(m => m.code === localeCountry)) {
      return localeCountry;
    }
    return "FR"; // Default fallback
  };
  
  // Get initial locale based on user's current locale and selected market
  const getInitialLocale = (marketCode: string) => {
    const marketData = TINK_MARKETS.find(m => m.code === marketCode);
    if (!marketData) return "en_US";
    
    // Try to match current locale with market's supported locales
    const currentLocaleFormatted = locale.replace('-', '_');
    if (isTinkLocale(currentLocaleFormatted) && (marketData.locales as readonly string[]).includes(currentLocaleFormatted)) {
      return currentLocaleFormatted;
    }
    
    // Try to match language part of locale
    const languageCode = locale.split('-')[0];
    const matchingLocale = marketData.locales.find(l => l.startsWith(languageCode));
    if (matchingLocale) {
      return matchingLocale;
    }
    
    return marketData.locales[0]; // Use first available locale for the market
  };
  
  const initialMarket = getInitialMarket();
  const [selectedMarket, setSelectedMarket] = useState<TinkMarketCode>(initialMarket as TinkMarketCode);
  const [selectedLocale, setSelectedLocale] = useState<TinkLocale>(getInitialLocale(initialMarket) as TinkLocale);
  const [isConnecting, setIsConnecting] = useState(false);

  const { mutateAsync: connectBankAccount } =
    trpc.account.connectBankAccount.useMutation();

  // Get available locales for the selected market
  const selectedMarketData = TINK_MARKETS.find(
    (m) => m.code === selectedMarket
  );
  const availableLocales = selectedMarketData?.locales || ["en_US"];

  // Auto-select best locale when market changes
  const handleMarketChange = (market: TinkMarketCode) => {
    setSelectedMarket(market);
    const marketData = TINK_MARKETS.find((m) => m.code === market);
    if (marketData) {
      // Try to match current locale, otherwise use first available
      const bestLocale =
        marketData.locales.find((l) => l.startsWith(locale.split("-")[0])) ||
        marketData.locales[0];
      setSelectedLocale(bestLocale as TinkLocale);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      // Call the tRPC procedure to get the secure connection URL
      const result = await connectBankAccount({
        market: selectedMarket,
        locale: selectedLocale,
      });

      // Validate URL before redirect for security
      const url = new URL(result.url);
      if (
        url.hostname !== "link.tink.com" &&
        !url.hostname.endsWith(".link.tink.com")
      ) {
        throw new Error("Invalid Tink URL domain");
      }

      // Redirect to Tink's connection flow
      window.location.href = result.url;
    } catch (error) {
      console.error("Failed to connect bank account:", error);
      // Error handling could be improved with toast notifications
    } finally {
      setIsConnecting(false);
    }
  };

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
                  <BreadcrumbLink href="/accounts">Accounts</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Connect Bank Account</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <ModeToggle />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Connect Bank Account</h1>
              <p className="text-muted-foreground">
                Choose your market and connect your bank account securely
              </p>
            </div>
            <Link href="/accounts">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Accounts
              </Button>
            </Link>
          </div>

          <div className="max-w-2xl mx-auto w-full">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Select Your Market
                </CardTitle>
                <CardDescription>
                  Choose the country where your bank account is located. This
                  ensures we connect to the right banking system with the
                  appropriate regulations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Market Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Country/Market
                  </label>
                  <Select
                    value={selectedMarket}
                    onValueChange={(value) => handleMarketChange(value as TinkMarketCode)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your country" />
                    </SelectTrigger>
                    <SelectContent>
                      {TINK_MARKETS.map((market) => (
                        <SelectItem key={market.code} value={market.code}>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{market.flag}</span>
                            <span>{market.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedMarketData && (
                    <p className="text-sm text-muted-foreground">
                      {selectedMarketData.description}
                    </p>
                  )}
                </div>

                {/* Locale Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Language Preference
                  </label>
                  <Select
                    value={selectedLocale}
                    onValueChange={(value) => setSelectedLocale(value as TinkLocale)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLocales.map((locale) => (
                        <SelectItem key={locale} value={locale}>
                          {locale.replace("_", " - ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    This will be used for the bank connection interface
                  </p>
                </div>

                {/* Selected Configuration Display */}
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Selected Configuration</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">
                      {selectedMarketData?.flag} {selectedMarketData?.name}
                    </Badge>
                    <Badge variant="outline">
                      {selectedLocale.replace("_", " - ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ll be redirected to Tink&apos;s secure banking
                    connection service for {selectedMarketData?.name}
                  </p>
                </div>

                {/* Security Notice */}
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Secure Connection:</strong> You&apos;ll be
                    redirected to Tink&apos;s secure platform. Your banking
                    credentials are never stored by our application and are
                    handled directly by your bank and Tink&apos;s certified
                    secure infrastructure.
                  </AlertDescription>
                </Alert>

                {/* Connect Button */}
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full"
                  size="lg"
                >
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
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
