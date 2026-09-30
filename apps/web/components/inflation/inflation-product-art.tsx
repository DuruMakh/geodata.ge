import Image from "next/image";

export function productArtPath(productId: string): string {
  const match = /^cpi\.product\.(p\d{4,})$/.exec(productId);
  if (!match) throw new Error(`Invalid product artwork ID: ${productId}`);
  return `/inflation-products/${match[1]}.webp`;
}

export function InflationProductArt({ productId, eager = false }: { productId: string; eager?: boolean }) {
  return <Image
    src={productArtPath(productId)}
    alt=""
    aria-hidden="true"
    width={32}
    height={32}
    className="h-8 w-8 shrink-0 object-contain"
    loading={eager ? "eager" : "lazy"}
    unoptimized
  />;
}
