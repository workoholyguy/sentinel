import { useId } from "react";

/** UPLink mark: a node sending signal upward. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38e1ff" />
          <stop offset="0.55" stopColor="#5b8cff" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="#0b0f17" stroke="rgb(255 255 255 / 0.12)" />
      <path d="M8.5 15.5 16 8l7.5 7.5" stroke={`url(#${id}-g)`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.8 20.2 16 16l4.2 4.2" stroke={`url(#${id}-g)`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx="16" cy="24.2" r="2" fill="#38e1ff" />
    </svg>
  );
}

// Devin's mark, rebuilt from three rounded hexagons with the keyhole notch and fillets cut out.
const HEX_R = 97.8; // circumradius, inset so the rounded stroke lands on the true edge
const hex = (cx: number, cy: number) =>
  [-90, -30, 30, 90, 150, 210]
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      return `${(cx + HEX_R * Math.cos(a)).toFixed(1)},${(cy + HEX_R * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");

export function DevinMark({ className = "h-5 w-5", color = "currentColor" }: { className?: string; color?: string }) {
  const id = useId();
  return (
    <svg viewBox="166 180 424 482" className={className} aria-label="Devin" role="img">
      <defs>
        <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="166" y="180" width="424" height="482">
          <g fill="white" stroke="white" strokeWidth="16" strokeLinejoin="round">
            <polygon points={hex(272, 299)} />
            <polygon points={hex(272, 543)} />
            <polygon points={hex(485, 421)} />
          </g>
          <polygon
            fill="white"
            points="364.7,300.3 436.7,341.9 485,421 436.7,500.1 364.7,541.7 364.7,489.5 272,436 272,406 364.7,352.5"
          />
          <g fill="black">
            <circle cx="412.7" cy="300.3" r="48" />
            <circle cx="412.7" cy="541.7" r="48" />
            <circle cx="345" cy="421" r="46" />
            <polygon points="262,411.8 345,363.9 345,478.1 262,430.2" />
          </g>
        </mask>
      </defs>
      <rect x="166" y="180" width="424" height="482" fill={color} mask={`url(#${id}-m)`} />
    </svg>
  );
}
