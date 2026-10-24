import { Eyebrow, Section } from "./ui";

// Names only, no logos: Uplink phones whichever provider's support line the business has.
const PROVIDERS = ["Comcast Business", "AT&T", "Verizon", "Spectrum", "Cox", "Lumen"];

export function Providers() {
  return (
    <Section className="pb-20 pt-4">
      <Eyebrow>Works with every major provider</Eyebrow>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-x-10 gap-y-4">
        {PROVIDERS.map((p) => (
          <span key={p} className="text-[19px] font-semibold tracking-[-0.02em] text-neutral-400">
            {p}
          </span>
        ))}
      </div>
    </Section>
  );
}
