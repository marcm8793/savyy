import {
  Wallet,
  TrendingUp,
  PieChart,
  Shield,
  Smartphone,
  Zap,
  BarChart3,
  Target,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "Connect All Your Accounts",
    description:
      "Securely link banks, brokers, and crypto platforms worldwide through Tink's trusted infrastructure. Get a complete view of your financial assets in one place.",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
  },
  {
    icon: TrendingUp,
    title: "Real-Time Asset Tracking",
    description:
      "Monitor all your financial assets 24/7 with live updates. Track performance across stocks, bonds, crypto, real estate, and savings accounts.",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/20",
  },
  {
    icon: PieChart,
    title: "Intelligent Portfolio Analysis",
    description:
      "Get deep insights into your asset allocation, risk exposure, and performance metrics. Understand exactly where your wealth is distributed.",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
  },
  {
    icon: BarChart3,
    title: "Personalized Insights",
    description:
      "Receive tailored recommendations based on your unique financial situation, goals, and risk tolerance. Every insight is crafted specifically for you.",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
  },
  {
    icon: Target,
    title: "Goal-Based Planning",
    description:
      "Set and track financial goals with precision. Whether it's retirement, a home purchase, or building wealth, we help you stay on track.",
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-950/20",
  },
  {
    icon: Shield,
    title: "Bank-Level Security",
    description:
      "Your data is protected with enterprise-grade security through Tink's regulated infrastructure. Read-only access ensures your accounts stay safe.",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/20",
  },
  {
    icon: Smartphone,
    title: "Cross-Platform Access",
    description:
      "Access your financial dashboard anywhere with our responsive web platform and upcoming mobile apps. Your data syncs seamlessly across devices.",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
  },
  {
    icon: Zap,
    title: "Smart Automation",
    description:
      "Automated categorization, expense tracking, and portfolio rebalancing alerts. Let technology handle the routine while you focus on strategy.",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
  },
  {
    icon: Globe,
    title: "Multi-Currency & Global",
    description:
      "Track investments and assets in multiple currencies with real-time exchange rates. Perfect for international portfolios and global assets.",
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-950/20",
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-400 dark:to-orange-500 bg-clip-text text-transparent">
              master your assets
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Savyy brings together all the tools you need to track, analyze, and
            optimize your financial assets. Powered by Tink&apos;s secure
            banking connections for complete visibility.
          </p>
        </div>

        {/* Features grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border bg-card p-8 hover:border-orange-200 dark:hover:border-orange-800 hover:shadow-lg transition-all duration-300"
              >
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.bgColor}`}
                >
                  <Icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-lg text-muted-foreground mb-6">
            Ready to take control of your financial assets?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span>Powered by Tink&apos;s secure infrastructure</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span>Real-time data & insights</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
