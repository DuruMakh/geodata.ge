import { householdPageMetadata } from "../../../../../lib/pages/household-shared";
import { renderHouseholdIndexPage } from "../../../../../lib/pages/household-index";
export const generateMetadata = () => householdPageMetadata("ka", "spending");
export default function Page() { return renderHouseholdIndexPage("ka", "spending"); }
