import { useId } from "react";

/** Uplink mark: stacked chevrons, signal going up. */
export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 10.5 12 4l7.5 6.5" />
      <path d="M4.5 15.25 12 8.75l7.5 6.5" />
      <path d="M4.5 20 12 13.5l7.5 6.5" />
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
