import Image from "next/image";
import { Eyebrow, Section } from "./ui";

type Provider = { name: string; logo: string; fill?: boolean };

// Each provider's own square mark, cropped into a circle. `fill` marks logos that bring their own background.
export const PROVIDERS: Provider[] = [
  { name: "Comcast Business", logo: "comcast.svg" },
  { name: "AT&T", logo: "att.svg" },
  { name: "Verizon", logo: "verizon.svg" },
  { name: "Spectrum", logo: "spectrum.svg" },
  { name: "Cox", logo: "cox.svg", fill: true },
  { name: "Lumen", logo: "lumen.svg" },
  { name: "T-Mobile", logo: "t-mobile.svg", fill: true },
  { name: "Frontier", logo: "frontier.png" },
  { name: "Optimum", logo: "optimum.png" },
  { name: "Windstream", logo: "windstream.png" },
  { name: "GFiber", logo: "gfiber.svg" },
  { name: "Starlink", logo: "starlink.svg" },
  { name: "Brightspeed", logo: "brightspeed.png" },
  { name: "Mediacom", logo: "mediacom.png" },
  { name: "Astound", logo: "astound.png" },
  { name: "Zayo", logo: "zayo.jpg", fill: true },
  { name: "Sparklight", logo: "sparklight.png" },
  { name: "WOW!", logo: "wow.png" },
  { name: "Consolidated", logo: "consolidated.png" },
];

const half = Math.ceil(PROVIDERS.length / 2);
const ROWS = [PROVIDERS.slice(0, half), PROVIDERS.slice(half)];

function Chip({ name, logo, fill }: Provider) {
  return (
    <li className="flex shrink-0 items-center gap-3 rounded-full border border-neutral-200/80 bg-white py-1.5 pl-1.5 pr-5 shadow-[0_10px_24px_-18px_rgb(0_0_0/0.3)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-neutral-200/70">
        <Image src={`/providers/${logo}`} alt="" width={40} height={40} unoptimized className={fill ? "h-full w-full object-cover" : "h-[62%] w-[62%] object-contain"} />
      </span>
      <span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] text-neutral-700">{name}</span>
    </li>
  );
}

/** One endless row: the list twice over, slid by exactly one copy so the loop has no seam. */
function Row({ items, reverse = false }: { items: Provider[]; reverse?: boolean }) {
  return (
    <div className="marquee flex overflow-hidden py-1 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      {[0, 1].map((copy) => (
        <ul key={copy} aria-hidden={copy === 1 || undefined} className={`marquee-track flex shrink-0 gap-3 pr-3 ${reverse ? "marquee-reverse" : ""}`}>
          {items.map((p) => (
            <Chip key={p.name} {...p} />
          ))}
        </ul>
      ))}
    </div>
  );
}

export function Providers() {
  return (
    <Section className="pb-20 pt-4">
      <Eyebrow>Works with every major provider</Eyebrow>
      <div className="mt-7 space-y-3">
        <Row items={ROWS[0]} />
        <Row items={ROWS[1]} reverse />
      </div>
    </Section>
  );
}
