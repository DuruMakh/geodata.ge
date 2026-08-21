import { resolveSiteUrl } from "../../lib/siteUrl";
import {
  breadcrumbJsonLd,
  type BreadcrumbItem,
} from "../../lib/seo/structuredData";
import { JsonLd } from "./json-ld";

export function BreadcrumbJsonLd({ items }: { items: readonly BreadcrumbItem[] }) {
  return <JsonLd data={breadcrumbJsonLd(resolveSiteUrl(), items)} testId="breadcrumb-json-ld" />;
}
