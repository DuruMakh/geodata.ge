import { serializeJsonLd } from "../../lib/seo/structuredData";

export function JsonLd({ data, testId }: { data: object; testId?: string }) {
  return (
    <script
      data-testid={testId}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
