import { useId } from "react";

/**
 * The Mehrmah symbol: a day ring from sun to moon around the "m".
 * Geometry is copied from the owner's logo kit (mehrmah-logo-kit-v2,
 * mehrmah-symbol-color.svg). The track and the "m" use theme tokens, so the
 * mark works in every theme and in dark mode.
 */
export function BrandMark({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const arc = `brand-arc-${uid}`;
  const cut = `brand-cut-${uid}`;
  return (
    <svg viewBox="44 44 424 424" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={arc} gradientUnits="userSpaceOnUse" x1="85.2" y1="0" x2="426.8" y2="0">
          <stop offset="0" style={{ stopColor: "var(--brand-sun)" }} />
          <stop offset=".5" style={{ stopColor: "var(--brand-dusk)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-moon)" }} />
        </linearGradient>
        <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <rect width="512" height="512" fill="#fff" />
          <circle cx="85.23" cy="172.71" r="46" fill="#000" />
          <circle cx="426.77" cy="172.71" r="46" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${cut})`} fill="none" strokeWidth="34">
        <circle cx="256" cy="256" r="190" style={{ stroke: "var(--track)" }} />
        <path d="M85.23 172.71 A190 190 0 0 1 426.77 172.71" stroke={`url(#${arc})`} />
      </g>
      <path
        transform="translate(256 282) scale(0.72) translate(-256 -302)"
        d="M112 392 V284 A72 72 0 0 1 256 284 V392 M256 284 A72 72 0 0 1 400 284 V392"
        fill="none"
        strokeWidth="54"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: "var(--ink)" }}
      />
      <circle cx="85.23" cy="172.71" r="34" style={{ fill: "var(--brand-sun)" }} />
      <path
        d="M422.63 136.95 A36 36 0 1 0 460.15 186.19 A30.96 30.96 0 0 1 422.63 136.95 Z"
        style={{ fill: "var(--brand-moon)" }}
      />
    </svg>
  );
}

type BrandLogoProps = {
  /** "sm" for the app bar, "md" for the auth screens. */
  size?: "sm" | "md";
  /** Show the ™ after the wordmark (brand screens, not the compact app bar). */
  trademark?: boolean;
};

/** Symbol + lowercase "mehrmah" wordmark in Poppins SemiBold, as in the kit's horizontal lockup. */
export function BrandLogo({ size = "sm", trademark = false }: BrandLogoProps) {
  const md = size === "md";
  return (
    <span className="inline-flex items-center gap-2">
      <BrandMark className={md ? "h-9 w-9" : "h-7 w-7"} />
      <span className={`font-semibold tracking-[-0.01em] text-ink ${md ? "text-[20px]" : "text-[17px]"}`}>
        mehrmah
        {trademark ? <sup className="ml-0.5 align-super text-[9px] font-medium">™</sup> : null}
      </span>
    </span>
  );
}
