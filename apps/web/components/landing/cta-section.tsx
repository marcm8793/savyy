import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";

const benefits = [
  "Connect all your financial accounts",
  "Real-time asset tracking & insights",
  "Personalized financial recommendations",
  "Bank-level security via Tink",
  "Multi-currency & global support",
  "Goal-based financial planning",
];

export default function CTASection() {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 dark:from-orange-800 dark:via-orange-900 dark:to-orange-950 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.1))]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center">
          {/* Main heading */}
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Ready to master{" "}
            <span className="text-orange-200">your financial assets?</span>
          </h2>

          {/* Subheading */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-orange-100">
            Take control of your financial future with Savyy. Connect all your
            accounts through Tink&apos;s secure infrastructure and get
            personalized insights to optimize your wealth.
          </p>

          {/* Benefits list */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3 text-white">
                <CheckCircle className="h-5 w-5 text-orange-200 flex-shrink-0" />
                <span className="text-sm sm:text-base">{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="bg-white text-orange-600 hover:bg-orange-50 px-8 py-4 text-lg font-semibold shadow-lg border-0"
            >
              Start Tracking Assets
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white hover:text-orange-600 px-8 py-4 text-lg"
            >
              Learn More
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-orange-200">
            <div className="flex items-center gap-2">
              <span>🔒</span>
              <span>Powered by Tink&apos;s secure API</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⚡</span>
              <span>Real-time data synchronization</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🎯</span>
              <span>Personalized for your goals</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🌍</span>
              <span>Global asset support</span>
            </div>
          </div>

          {/* Final trust message */}
          <div className="mt-8 text-center">
            <p className="text-orange-200 text-sm">
              Built on Tink&apos;s trusted banking infrastructure used by
              leading financial institutions
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
