const LINEAGE = "SOURCE → METHOD → CHECK → DATA";

export function OpenDocumentVisual() {
  return (
    <figure
      role="img"
      aria-label="ღია დოკუმენტი, რომელიც პირველწყაროდან შემოწმებულ მონაცემებამდე გზას აჩვენებს"
      className="m-0 text-[var(--ink)]"
    >
      <svg aria-hidden="true" viewBox="0 0 560 350" className="block h-auto w-full">
        <path d="M32 67 266 37v250L32 316Z" fill="var(--tint)" stroke="currentColor" strokeWidth="1.5" />
        <path d="m294 37 234 30v249l-234-29Z" fill="var(--tint)" stroke="currentColor" strokeWidth="1.5" />
        <path d="M280 42v246" stroke="currentColor" strokeWidth="1.5" />
        <g stroke="var(--hairline)" strokeWidth="1">
          <path d="m66 105 160-18M66 132l126-14M66 159l160-18M66 186l105-12M66 213l160-18" />
          <path d="m334 90 154 18M334 119l118 14M334 148l154 18M334 177l98 11M334 206l154 18" />
        </g>
        <path d="M87 253c41-28 76-12 108-45 19-19 35-24 53-25" fill="none" stroke="var(--accent)" strokeWidth="3" />
        <circle cx="87" cy="253" r="5" fill="var(--accent)" />
        <circle cx="248" cy="183" r="5" fill="var(--accent)" />
        <path d="M318 254h162" stroke="var(--accent)" strokeWidth="2" />
        <path d="m470 246 10 8-10 8" fill="none" stroke="var(--accent)" strokeWidth="2" />
        <text x="280" y="333" textAnchor="middle" fill="currentColor" fontSize="13" letterSpacing="1.6">
          {LINEAGE}
        </text>
      </svg>
    </figure>
  );
}

export function SourceDocumentStack() {
  return (
    <figure
      role="img"
      aria-label="სამი გადაფარული პირველწყაროს დოკუმენტი"
      className="m-0 text-[var(--ink)]"
    >
      <svg aria-hidden="true" viewBox="0 0 430 270" className="block h-auto w-full">
        <g transform="translate(50 35) rotate(-7 120 90)">
          <rect width="238" height="180" fill="var(--tint)" stroke="currentColor" strokeWidth="1.4" />
          <path d="M25 43h158M25 67h178M25 91h139M25 115h170M25 139h112" stroke="var(--hairline)" />
        </g>
        <g transform="translate(116 20) rotate(5 120 90)">
          <rect width="238" height="180" fill="var(--tint)" stroke="currentColor" strokeWidth="1.4" />
          <path d="M25 43h158M25 67h178M25 91h139M25 115h170M25 139h112" stroke="var(--hairline)" />
        </g>
        <g transform="translate(94 61)">
          <rect width="238" height="180" fill="var(--tint)" stroke="currentColor" strokeWidth="1.6" />
          <path d="M25 43h158M25 67h178M25 91h139M25 115h170M25 139h112" stroke="var(--hairline)" />
          <path d="M25 155h102" stroke="var(--accent)" strokeWidth="3" />
        </g>
      </svg>
    </figure>
  );
}

export { LINEAGE };
