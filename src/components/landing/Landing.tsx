import { buildDottedMap } from "../ui/dotted-map";
import { Cost } from "./Cost";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Nav } from "./Nav";
import { Providers } from "./Providers";
import { Steps } from "./Steps";

// Built on the server (the page is static), so the map data never ships dotted-map to the browser.
const US = buildDottedMap({
  height: 70,
  region: { lat: { min: 22, max: 56 }, lng: { min: -128, max: -64 } },
  places: {
    sf: { lat: 37.77, lng: -122.42 },
    sea: { lat: 47.61, lng: -122.33 },
    den: { lat: 39.74, lng: -104.99 },
    chi: { lat: 41.88, lng: -87.63 },
    aus: { lat: 30.27, lng: -97.74 },
    atl: { lat: 33.75, lng: -84.39 },
    ny: { lat: 40.71, lng: -74.0 },
  },
});

const WORLD = buildDottedMap({
  height: 56,
  places: {
    sf: { lat: 37.77, lng: -122.42, label: "San Francisco" },
    ny: { lat: 40.71, lng: -74.0, label: "New York" },
    sao: { lat: -23.55, lng: -46.63, label: "São Paulo" },
    lon: { lat: 51.51, lng: -0.13, label: "London" },
    sin: { lat: 1.35, lng: 103.82, label: "Singapore" },
    tok: { lat: 35.68, lng: 139.69, label: "Tokyo" },
  },
});

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-white text-neutral-950">
      <Nav />
      <main className="relative z-10 rounded-b-[28px] bg-[#fafafa] shadow-[0_30px_60px_-30px_rgb(0_0_0/0.18)] sm:rounded-b-[40px]">
        <Hero map={US} />
        <Providers />
        <Steps />
        <Cost />
      </main>
      <Footer map={WORLD} />
    </div>
  );
}
