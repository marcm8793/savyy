import Navbar from "./navbar";
import HeroSection from "./hero-section";
import FeaturesSection from "./features-section";
import CTASection from "./cta-section";
import Footer from "./footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
