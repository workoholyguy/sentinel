import { useId } from "react";

// Uplink mark: a U, a rising 1-shaped arrow, and the green "link up" dot between them.
const MARK_VIEWBOX = "408 316 530 530";
const MARK_U = "M413 408L505 484Q523 499 523 522L523 655Q523 705 580 705Q615 705 645 685L725 627L725 715Q725 735 708 750L655 792Q625 815 575 815Q413 815 413 680Z";
const MARK_ARROW = "M933 345L838 345Q805 345 782 364L660 466L660 510L738 510Q748 510 756 503L808 461Q825 450 825 470L825 702L908 633Q933 612 933 584Z";

/** The U takes the text colour, so the mark reads on white (dark U) and on black (white U). */
export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-arrow`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a3a3a3" />
          <stop offset="1" stopColor="#525252" />
        </linearGradient>
        <linearGradient id={`${id}-dot`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bef264" />
          <stop offset="1" stopColor="#65c11b" />
        </linearGradient>
      </defs>
      <path d={MARK_U} fill="currentColor" />
      <path d={MARK_ARROW} fill={`url(#${id}-arrow)`} />
      <circle cx="673" cy="583" r="43" fill={`url(#${id}-dot)`} />
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
