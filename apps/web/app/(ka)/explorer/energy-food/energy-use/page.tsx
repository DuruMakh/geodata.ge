import { energyFoodPageMetadata, renderEnergyFoodPage } from "../../../../../lib/pages/energy-food";
export const generateMetadata = () => energyFoodPageMetadata("ka", "energy-use");
export default function Page() { return renderEnergyFoodPage("ka", "energy-use"); }
