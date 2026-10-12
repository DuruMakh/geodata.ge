import { householdPageMetadata, renderHouseholdPage } from "../../../../../lib/pages/household";
export const generateMetadata = () => householdPageMetadata("ka", "spending");
export default function Page() { return renderHouseholdPage("ka", "spending"); }
