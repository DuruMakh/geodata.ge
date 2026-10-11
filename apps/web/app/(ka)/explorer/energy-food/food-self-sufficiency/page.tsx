import { energyFoodPageMetadata, renderEnergyFoodPage } from "../../../../../lib/pages/energy-food";
export const generateMetadata = () => energyFoodPageMetadata("ka", "food-self-sufficiency");
export default function Page() { return renderEnergyFoodPage("ka", "food-self-sufficiency"); }
