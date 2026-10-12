import { householdPageMetadata, renderHouseholdPage } from "../../../../../../lib/pages/household";
export const generateMetadata = () => householdPageMetadata("en", "income");
export default function Page() { return renderHouseholdPage("en", "income"); }
