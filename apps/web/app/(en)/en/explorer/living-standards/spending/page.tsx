import { householdPageMetadata, renderHouseholdPage } from "../../../../../../lib/pages/household";
export const generateMetadata = () => householdPageMetadata("en", "spending");
export default function Page() { return renderHouseholdPage("en", "spending"); }
