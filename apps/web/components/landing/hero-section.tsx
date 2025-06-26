import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Shield, Zap, DollarSign } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-background to-orange-50/50 dark:from-orange-950/20 dark:via-background dark:to-orange-950/10 py-20 md:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm">
            <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
            Powered by Tink&apos;s secure banking infrastructure
          </div>

          {/* Main heading */}
          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            Master Your{" "}
            <span className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-400 dark:to-orange-500 bg-clip-text text-transparent">
              Financial Assets
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Take complete control of your financial future with Savyy. Track all
            your assets, get personalized insights, and make smarter investment
            decisions with our intelligent platform.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-3 text-lg font-semibold border-0"
            >
              Start Tracking Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="px-8 py-3 text-lg border-border"
            >
              See How It Works
            </Button>
          </div>

          {/* Key benefits */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
              Bank-level security
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              Real-time tracking
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              All asset types
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              Personalized insights
            </div>
          </div>
        </div>

        {/* Hero image/dashboard preview */}
        <div className="mt-16 sm:mt-24">
          <div className="relative mx-auto max-w-5xl">
            <div className="relative rounded-2xl bg-card p-2 shadow-2xl ring-1 ring-border">
              <div className="rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 p-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {/* Portfolio Overview Card */}
                  <div className="rounded-lg bg-card p-6 shadow-sm border border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Total Assets
                      </h3>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-foreground">
                        €127,450
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        +12.5% this month
                      </div>
                    </div>
                  </div>

                  {/* Savings Card */}
                  <div className="rounded-lg bg-card p-6 shadow-sm border border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Liquid Assets
                      </h3>
                      <DollarSign className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-foreground">
                        €45,230
                      </div>
                      <div className="text-sm text-orange-600 dark:text-orange-400">
                        Across 3 accounts
                      </div>
                    </div>
                  </div>

                  {/* Investments Card */}
                  <div className="rounded-lg bg-card p-6 shadow-sm border border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Investments
                      </h3>
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-foreground">
                        €82,220
                      </div>
                      <div className="text-sm text-orange-600 dark:text-orange-400">
                        Diversified portfolio
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart placeholder */}
                <div className="mt-6 rounded-lg bg-card p-6 shadow-sm border border-border">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      Asset Performance
                    </h3>
                    <div className="text-sm text-muted-foreground">
                      Personalized for you
                    </div>
                  </div>
                  <div className="h-32 rounded bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-900/20 dark:to-orange-800/20 flex items-end justify-center">
                    <div className="text-sm text-muted-foreground mb-4">
                      📊 Intelligent analytics & insights
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
