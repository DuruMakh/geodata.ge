import { inflationCategoriesMetadata, renderInflationCategories } from "../../../../../lib/pages/inflation-categories";

export function generateMetadata() {
  return inflationCategoriesMetadata("ka");
}

export default function Page() {
  return renderInflationCategories("ka");
}
