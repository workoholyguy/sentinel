import { useId } from "react";

export type Mood = "happy" | "worried";

// Puffs drawn back to front; each gets its own shading so the cloud reads as soft and round.
const PUFFS: Array<[number, number, number]> = [
  [100, 78, 50],
  [148, 84, 43],
  [62, 104, 41],
  [180, 112, 31],
  [40, 124, 25],
  [88, 122, 34],
  [134, 121, 35],
];

const INK = "#1e1b4b";

/** UPLink's mascot: a little cloud (the internet) that frowns during an outage and grins when it's fixed. */
export function CloudBuddy({ mood = "happy", className = "w-40" }: { mood?: Mood; className?: string }) {
  const id = useId();
  const happy = mood === "happy";
  return (
    <svg viewBox="0 0 220 205" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-puff`} cx="36%" cy="28%" r="78%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f6f3ff" />
          <stop offset="1" stopColor="#c4b8f2" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <ellipse cx="110" cy="166" rx="72" ry="9" fill="#312e81" opacity="0.22" filter={`url(#${id}-blur)`} />

      {/* lightning while it's broken */}
      {!happy && (
        <polygon
          points="114,146 98,176 111,176 101,200 129,164 115,164 123,146"
          fill="#facc15"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinejoin="round"
          className="zap"
        />
      )}

      {PUFFS.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={`url(#${id}-puff)`} />
      ))}

      {/* face */}
      <g className="blink">
        <ellipse cx="94" cy="104" rx="7" ry={happy ? 9.5 : 8} fill={INK} />
        <ellipse cx="126" cy="104" rx="7" ry={happy ? 9.5 : 8} fill={INK} />
        <circle cx="96.6" cy="100" r="2.6" fill="#fff" />
        <circle cx="128.6" cy="100" r="2.6" fill="#fff" />
      </g>
      <ellipse cx="81" cy="117" rx="8" ry="4.5" fill="#f9a8d4" opacity={happy ? 0.85 : 0.4} />
      <ellipse cx="139" cy="117" rx="8" ry="4.5" fill="#f9a8d4" opacity={happy ? 0.85 : 0.4} />
      {happy ? (
        <path d="M101 115 Q110 127 119 115 Z" fill={INK} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      ) : (
        <>
          <path d="M86 92 L99 88" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M134 92 L121 88" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M101 121 Q105.5 116 110 121 Q114.5 126 119 121" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      {/* sparkles once it's happy again */}
      {happy &&
        [
          [34, 64, 0],
          [190, 56, 0.8],
          [176, 150, 1.6],
        ].map(([x, y, d]) => (
          <path
            key={`${x}-${y}`}
            d={`M${x} ${y - 9} Q${x + 1.5} ${y - 1.5} ${x + 9} ${y} Q${x + 1.5} ${y + 1.5} ${x} ${y + 9} Q${x - 1.5} ${y + 1.5} ${x - 9} ${y} Q${x - 1.5} ${y - 1.5} ${x} ${y - 9} Z`}
            fill="#fde68a"
            className="sparkle"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
    </svg>
  );
}
