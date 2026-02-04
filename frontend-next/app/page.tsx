import Navigation from '../components/landing/Navigation';
import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import CTASection from '../components/landing/CTASection';
import Footer from '../components/landing/Footer';
import Prefetch from '../components/Prefetch';
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Prefetch />
      <Navigation />
      <Hero />
      <Features />
      <CTASection />
      <Footer />
      <SpeedInsights />
      <Analytics />
    </main>
  );
}
