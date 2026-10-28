import { useId } from "react";

/** Uplink's mark — the U, the arrow rising out of it, and the dot. Same drawing as public/brand/uplink-icon.svg. */
export function UplinkMark({ className = "" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="408 316 530 530" className={className} role="img" aria-label="Uplink">
      <defs>
        <linearGradient id={`${id}-arrow`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9a9a9a" />
          <stop offset="1" stopColor="#5a5a5a" />
        </linearGradient>
        <linearGradient id={`${id}-dot`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4f56a" />
          <stop offset="1" stopColor="#7ed321" />
        </linearGradient>
      </defs>
      <path d="M413 408L505 484Q523 499 523 522L523 655Q523 705 580 705Q615 705 645 685L725 627L725 715Q725 735 708 750L655 792Q625 815 575 815Q413 815 413 680Z" fill="#f2f2f0" />
      <path d="M933 345L838 345Q805 345 782 364L660 466L660 510L738 510Q748 510 756 503L808 461Q825 450 825 470L825 702L908 633Q933 612 933 584Z" fill={`url(#${id}-arrow)`} />
      <circle cx="673" cy="583" r="43" fill={`url(#${id}-dot)`} />
    </svg>
  );
}
