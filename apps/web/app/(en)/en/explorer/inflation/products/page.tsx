import { inflationProductsMetadata, renderInflationProducts } from "../../../../../../lib/pages/inflation";

export function generateMetadata() {
  return inflationProductsMetadata("en");
}

export default function Page() {
  return renderInflationProducts("en");
}
