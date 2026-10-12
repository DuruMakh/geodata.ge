import { energyFoodPageMetadata, renderEnergyFoodPage } from "../../../../../../lib/pages/energy-food";
export const generateMetadata = () => energyFoodPageMetadata("en", "energy-use");
export default function Page() { return renderEnergyFoodPage("en", "energy-use"); }
