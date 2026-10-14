import { householdPageMetadata } from "../../../../../../lib/pages/household-shared";
import { renderHouseholdIndexPage } from "../../../../../../lib/pages/household-index";
export const generateMetadata = () => householdPageMetadata("en", "income");
export default function Page() { return renderHouseholdIndexPage("en", "income"); }
