import { inflationProductsMetadata, renderInflationProducts } from "../../../../../lib/pages/inflation";

export function generateMetadata() {
  return inflationProductsMetadata("ka");
}

export default function Page() {
  return renderInflationProducts("ka");
}
