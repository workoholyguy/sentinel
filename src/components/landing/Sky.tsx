import { useId } from "react";

// Deterministic "random" so server and client render the same sky.
function rng(seed: number) {
  let s = seed;
  for (let i = 0; i < 8; i++) s = (s * 16807) % 2147483647; // small seeds start near zero; warm up
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const STAR_COUNT = 70;
function stars(seed: number) {
  const r = rng(seed);
  return Array.from({ length: STAR_COUNT }, () => ({
    left: r() * 100,
    top: r() * 100,
    size: r() > 0.85 ? 3 : r() > 0.5 ? 2 : 1.5,
    tw: 2 + r() * 4,
    delay: r() * 4,
  }));
}

function puffs(seed: number, count: number, minR: number, maxR: number) {
  const r = rng(seed);
  const step = 1600 / count;
  return Array.from({ length: count }, (_, i) => ({
    cx: i * step + r() * step * 0.8,
    cy: 230 - r() * 90,
    r: minR + r() * (maxR - minR),
  }));
}

const BACK = puffs(7, 16, 90, 160);
const FRONT = puffs(19, 20, 70, 130);

/** A bank of soft clouds along the bottom edge of its box (flip it to hang from the top). */
function CloudBank({ flip = false }: { flip?: boolean }) {
  const id = useId();
  return (
    <div className={`pointer-events-none absolute inset-x-0 h-[300px] ${flip ? "top-0 rotate-180" : "bottom-0"}`}>
      <svg viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice" className="drift absolute bottom-0 left-0 h-full w-[112%]" style={{ ["--drift" as string]: "46s" }} aria-hidden="true">
        <defs>
          <radialGradient id={`${id}-back`} cx="45%" cy="35%" r="70%">
            <stop offset="0" stopColor="#fdf4ff" />
            <stop offset="1" stopColor="#e9d5ff" />
          </radialGradient>
        </defs>
        {BACK.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={`url(#${id}-back)`} opacity="0.85" />
        ))}
        <rect x="0" y="230" width="1600" height="70" fill="#f5edff" />
      </svg>
      <svg
        viewBox="0 0 1600 300"
        preserveAspectRatio="xMidYMax slice"
        className="drift absolute bottom-0 left-[-6%] h-[82%] w-[112%]"
        style={{ ["--drift" as string]: "32s", animationDirection: "alternate-reverse" }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`${id}-front`} cx="40%" cy="30%" r="75%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.7" stopColor="#fbf8ff" />
            <stop offset="1" stopColor="#ece4ff" />
          </radialGradient>
        </defs>
        {FRONT.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy + 30} r={p.r} fill={`url(#${id}-front)`} />
        ))}
        <rect x="0" y="250" width="1600" height="50" fill="#fafafa" />
      </svg>
    </div>
  );
}

function Stars({ seed, className }: { seed: number; className: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 ${className}`} aria-hidden="true">
      {stars(seed).map((s, i) => (
        <span
          key={i}
          className="twinkle absolute rounded-full bg-white"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, ["--tw" as string]: `${s.tw}s`, animationDelay: `${s.delay}s` }}
        />
      ))}
    </div>
  );
}

/** The indigo night sky from the references: stars up high, clouds where it meets the page. */
export function Sky({ variant }: { variant: "top" | "bottom" }) {
  const top = variant === "top";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: top
            ? "linear-gradient(180deg, #23216e 0%, #3730a3 22%, #5b4fcf 42%, #8f7ae6 60%, #c9b6f5 76%, #f3eaff 90%, #fafafa 100%)"
            : "linear-gradient(180deg, #fafafa 0%, #efe6ff 7%, #b9a5f2 15%, #7a66de 26%, #4b40c2 42%, #2a2580 66%, #14123d 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: top
            ? "radial-gradient(40% 30% at 18% 62%, rgb(244 114 182 / 0.22), transparent 70%), radial-gradient(40% 30% at 85% 58%, rgb(96 165 250 / 0.2), transparent 70%)"
            : "radial-gradient(40% 30% at 20% 40%, rgb(244 114 182 / 0.2), transparent 70%), radial-gradient(40% 30% at 82% 45%, rgb(96 165 250 / 0.18), transparent 70%)",
        }}
      />
      <Stars seed={top ? 3 : 11} className={top ? "top-0 h-[55%]" : "bottom-0 h-[55%]"} />
      <CloudBank flip={!top} />
    </div>
  );
}
