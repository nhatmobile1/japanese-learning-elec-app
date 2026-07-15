const PATTERN_IDS = ['seigaiha', 'shippo', 'yabane'] as const;

/** Shared SVG <pattern> definitions. Mount exactly once, near the app root. */
export default function PatternDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="p-seigaiha" width="40" height="20" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.1">
            <path d="M2 20 a18 18 0 0 1 36 0" /><path d="M8 20 a12 12 0 0 1 24 0" /><path d="M14 20 a6 6 0 0 1 12 0" />
            <path d="M-18 10 a18 18 0 0 1 36 0" /><path d="M-12 10 a12 12 0 0 1 24 0" /><path d="M-6 10 a6 6 0 0 1 12 0" />
            <path d="M22 10 a18 18 0 0 1 36 0" /><path d="M28 10 a12 12 0 0 1 24 0" /><path d="M34 10 a6 6 0 0 1 12 0" />
          </g>
        </pattern>
        <pattern id="p-shippo" width="24" height="24" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <circle cx="0" cy="0" r="12" /><circle cx="24" cy="0" r="12" /><circle cx="0" cy="24" r="12" />
            <circle cx="24" cy="24" r="12" /><circle cx="12" cy="12" r="12" />
          </g>
        </pattern>
        <pattern id="p-yabane" width="20" height="20" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M0 3 L10 13 L20 3" /><path d="M0 13 L10 23 L20 13" /><path d="M0 -7 L10 3 L20 -7" />
          </g>
        </pattern>
      </defs>
    </svg>
  );
}

/** A band that shows the user's chosen pattern (CSS picks the visible rect). */
export function PatternBand({ className }: { className?: string }) {
  return (
    <span className={className ? `pattern-band ${className}` : 'pattern-band'} aria-hidden="true">
      <svg preserveAspectRatio="none">
        {PATTERN_IDS.map((id) => (
          <rect key={id} className={`pat-${id}`} width="100%" height="100%" fill={`url(#p-${id})`} />
        ))}
      </svg>
    </span>
  );
}
