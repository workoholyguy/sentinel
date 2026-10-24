import { Closing } from "./Closing";
import { Cost } from "./Cost";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { Nav } from "./Nav";
import { Providers } from "./Providers";
import { Statement } from "./Statement";

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#fafafa] text-neutral-950">
      <Nav />
      <main>
        <Hero />
        <Providers />
        <Statement />
        <Features />
        <Cost />
      </main>
      <Closing />
    </div>
  );
}
