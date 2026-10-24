// Names only, no logos: UPLink phones whichever provider's support line the customer has.
const PROVIDERS = ["Comcast Business", "AT&T", "Verizon", "Spectrum", "Cox", "Frontier", "Optimum", "Google Fiber", "T-Mobile", "Lumen"];

export function Providers() {
  return (
    <div className="relative border-y hairline bg-white/[0.01]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 py-7 sm:flex-row sm:items-center sm:gap-10 sm:px-8 lg:px-14">
        <div className="shrink-0 font-mono text-[11px] uppercase tracking-label text-white/35">
          Calls any provider&apos;s
          <br className="hidden sm:block" /> support line
        </div>
        <div className="fade-x min-w-0 flex-1 overflow-hidden">
          <div className="marquee flex w-max gap-14">
            {[...PROVIDERS, ...PROVIDERS].map((p, i) => (
              <span key={i} aria-hidden={i >= PROVIDERS.length} className="whitespace-nowrap text-[21px] font-semibold tracking-[-0.03em] text-white/25">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
