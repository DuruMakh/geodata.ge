/** A region page's list of its municipalities: rank, name and figure, each row a link. */
export function EntityMemberList({
  heading,
  rows,
}: {
  heading: string;
  rows: Array<{ id: string; href: string; rank: number; label: string; value: string }>;
}) {
  return (
    <div className="mt-11 border-t-2 border-[var(--ink)] pt-[22px]">
      <h2 className="mb-3.5 font-[family-name:var(--font-display)] text-[22px] font-semibold">{heading}</h2>
      {rows.map((row) => (
        <a
          key={row.id}
          href={row.href}
          data-testid="region-member-row"
          className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2 text-[var(--ink)] no-underline hover:bg-[var(--tint)]"
        >
          <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">{String(row.rank).padStart(2, "0")}</span>
          <span className="truncate text-[12.5px]">{row.label}</span>
          <span className="font-[family-name:var(--font-numeric)] text-[11.5px]">{row.value}</span>
        </a>
      ))}
    </div>
  );
}
