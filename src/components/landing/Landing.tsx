import { Footer } from "./Footer";
import { ForTeams } from "./ForTeams";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Nav } from "./Nav";
import { Offline } from "./Offline";
import { Platforms } from "./Platforms";
import { Problem } from "./Problem";
import { Providers } from "./Providers";

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-950 text-white">
      <Nav />
      <main>
        <Hero />
        <Providers />
        <Problem />
        <HowItWorks />
        <Offline />
        <ForTeams />
        <Platforms />
      </main>
      <Footer />
    </div>
  );
}
