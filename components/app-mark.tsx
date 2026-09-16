import { cn } from '@/lib/utils';

/**
 * The Next Chapter mark: the hairline ring and serif "n." from
 * public/favicon.svg, but without the favicon's filled teal square. An icon
 * needs its own background to survive on a home screen; in the header that
 * same tile reads as a heavy box sitting on top of the page.
 *
 * The glyph inherits currentColor so it stays legible in both themes, while the
 * ring keeps the mark's soft sage.
 */
export function AppMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn('size-9', className)}
      // The wordmark beside it already reads "Next Chapter".
      aria-hidden="true"
    >
      <circle
        cx="256"
        cy="256"
        r="228"
        fill="none"
        stroke="#94b8aa"
        strokeWidth="1.25"
        // Keeps the ring a hairline at header size instead of vanishing.
        vectorEffect="non-scaling-stroke"
      />
      <text
        x="256"
        y="332"
        textAnchor="middle"
        // A class, not a fontFamily attribute: var() is not resolved in SVG
        // presentation attributes, only in CSS.
        className="font-serif"
        fontSize="248"
        fill="currentColor"
      >
        n.
      </text>
    </svg>
  );
}
