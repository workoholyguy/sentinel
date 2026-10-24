import Feature from "../ui/block-feature";
import { Eyebrow, Section } from "./ui";

export function Features() {
  return (
    <Section id="why" className="py-24 sm:py-32">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
        <div>
          <Eyebrow dot>Why Uplink</Eyebrow>
          <h2 className="mt-5 text-[clamp(32px,3.6vw,44px)] font-semibold leading-[1.1] tracking-[-0.035em] text-neutral-950">
            Built for teams that
            <br />
            <span className="text-neutral-400">can&apos;t afford to be offline.</span>
          </h2>
        </div>
        <p className="max-w-[440px] text-[16.5px] leading-[1.65] text-neutral-500 lg:justify-self-end">
          Offices, clinics, shops and IT teams run on the connection. Uplink keeps it up, and keeps the receipts when it isn&apos;t.
        </p>
      </div>
      <div className="mt-12">
        <Feature />
      </div>
    </Section>
  );
}
