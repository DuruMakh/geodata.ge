import Link from "next/link";
import { resolveSiteUrl } from "../../lib/siteUrl";
import {
  breadcrumbJsonLd,
  type BreadcrumbItem,
} from "../../lib/seo/structuredData";
import { JsonLd } from "./json-ld";

export function BreadcrumbJsonLd({ items }: { items: readonly BreadcrumbItem[] }) {
  return <JsonLd data={breadcrumbJsonLd(resolveSiteUrl(), items)} testId="breadcrumb-json-ld" />;
}

export function BreadcrumbTrail({
  items,
  className,
}: {
  items: readonly BreadcrumbItem[];
  className?: string;
}) {
  return (
    <>
      <BreadcrumbJsonLd items={items} />
      <nav
        aria-label="Breadcrumb"
        className={className ?? "border-t-2 border-[var(--ink)] pt-3 text-[11px] text-[var(--muted)]"}
      >
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <span key={item.path}>
              {index > 0 ? <span aria-hidden="true" className="mx-2">/</span> : null}
              {current ? (
                <span data-breadcrumb-label aria-current="page">{item.name}</span>
              ) : (
                <Link
                  data-breadcrumb-label
                  href={item.path}
                  className="underline underline-offset-4 hover:text-[var(--accent)]"
                >
                  {item.name}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}
