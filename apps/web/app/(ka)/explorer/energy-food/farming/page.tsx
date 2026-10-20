import { energyFoodPageMetadata, renderEnergyFoodPage } from "../../../../../lib/pages/energy-food";
export const generateMetadata = () => energyFoodPageMetadata("ka", "farming");
export default function Page() { return renderEnergyFoodPage("ka", "farming"); }
