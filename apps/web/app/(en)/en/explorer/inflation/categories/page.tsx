import { inflationCategoriesMetadata, renderInflationCategories } from "../../../../../../lib/pages/inflation";

export function generateMetadata() {
  return inflationCategoriesMetadata("en");
}

export default function Page() {
  return renderInflationCategories("en");
}
