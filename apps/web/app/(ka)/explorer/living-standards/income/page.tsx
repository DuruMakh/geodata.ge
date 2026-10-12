import { householdPageMetadata, renderHouseholdPage } from "../../../../../lib/pages/household";
export const generateMetadata = () => householdPageMetadata("ka", "income");
export default function Page() { return renderHouseholdPage("ka", "income"); }
