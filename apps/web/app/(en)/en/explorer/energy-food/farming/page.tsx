import { energyFoodPageMetadata, renderEnergyFoodPage } from "../../../../../../lib/pages/energy-food";
export const generateMetadata = () => energyFoodPageMetadata("en", "farming");
export default function Page() { return renderEnergyFoodPage("en", "farming"); }
