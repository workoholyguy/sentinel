// Server-side only: builds the dot grid for <WorldMap>. Kept out of client components so the
// country shapes in dotted-map never ship to the browser; the page is rendered at build time.
import DottedMap, { type Region } from "dotted-map";

export interface Place {
  lat: number;
  lng: number;
  label?: string;
}

export interface MapPin {
  x: number;
  y: number;
  label?: string;
}

export interface MapData {
  width: number;
  height: number;
  /** every dot as a zero-length segment; drawn with round caps it renders as a circle */
  dots: string;
  pins: Record<string, MapPin>;
}

export function buildDottedMap({ height, region, places }: { height: number; region?: Region; places: Record<string, Place> }): MapData {
  const map = new DottedMap({ height, grid: "diagonal", ...(region ? { region } : {}) });
  const r = (n: number) => Math.round(n * 100) / 100;
  const dots = map
    .getPoints()
    .map((p) => `M${r(p.x)} ${r(p.y)}h0`)
    .join("");
  const pins: Record<string, MapPin> = {};
  for (const [id, place] of Object.entries(places)) {
    const pin = map.getPin({ lat: place.lat, lng: place.lng });
    if (pin) pins[id] = { x: r(pin.x), y: r(pin.y), label: place.label };
  }
  return { width: map.image.width, height: map.image.height, dots, pins };
}
