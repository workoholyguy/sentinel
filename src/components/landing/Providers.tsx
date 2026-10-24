import { Eyebrow, Section } from "./ui";

// Names only, no logos: UPLink phones whichever provider's support line the customer has.
const PROVIDERS = ["Comcast", "AT&T", "Verizon", "Spectrum", "Cox", "Frontier", "Optimum", "Google Fiber", "T-Mobile", "Lumen"];

export function Providers() {
  return (
    <Section className="py-14">
      <Eyebrow className="text-center">Calls any provider&apos;s support line</Eyebrow>
      <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-5">
        {PROVIDERS.map((p) => (
          <span key={p} className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-400 transition-colors hover:text-neutral-700">
            {p}
          </span>
        ))}
      </div>
    </Section>
  );
}
