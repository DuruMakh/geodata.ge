import { energyFoodPageMetadata, renderEnergyFoodPage } from "../../../../../lib/pages/energy-food";
export const generateMetadata = () => energyFoodPageMetadata("ka", "electricity");
export default function Page() { return renderEnergyFoodPage("ka", "electricity"); }
