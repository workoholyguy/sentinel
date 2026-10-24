import type { ReactNode } from "react";

// Uplink's own small line icons (20px grid, 1.5 stroke), so the product visuals don't look like a stock icon pack.
type GlyphProps = { className?: string };

function Glyph({ className = "h-5 w-5", children }: GlyphProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const OfficeGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M3.5 17V5.5L10 3v14M10 7.5l6.5 2V17M2 17h16" />
    <path d="M6 7.5v.01M6 10.5v.01M6 13.5v.01M13 12v.01M13 14.5v.01" />
  </Glyph>
);

export const RouterGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <rect x="2.5" y="11" width="15" height="5.5" rx="1.5" />
    <path d="M6 13.75h.01M9 13.75h.01M13.5 11V7M11.5 5.5a3 3 0 0 1 4 0M10 3.8a5.2 5.2 0 0 1 7 0" />
  </Glyph>
);

export const TowerGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M10 8v9M7 17l3-9 3 9M7.5 13.5h5" />
    <circle cx="10" cy="6.5" r="1.25" />
    <path d="M6.5 3.5a5 5 0 0 0 0 6M13.5 3.5a5 5 0 0 1 0 6" />
  </Glyph>
);

export const GlobeGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M3 10h14M10 3c2 2.2 2.8 4.5 2.8 7s-.8 4.8-2.8 7c-2-2.2-2.8-4.5-2.8-7S8 5.2 10 3Z" />
  </Glyph>
);

export const PhoneGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M6.5 3h-2A1.5 1.5 0 0 0 3 4.6C3.4 11.6 8.4 16.6 15.4 17A1.5 1.5 0 0 0 17 15.5v-2l-3.2-1.3-1.6 1.6a8.6 8.6 0 0 1-4-4l1.6-1.6Z" />
  </Glyph>
);

export const SearchGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <circle cx="8.5" cy="8.5" r="5" />
    <path d="m12.5 12.5 4 4" />
  </Glyph>
);
