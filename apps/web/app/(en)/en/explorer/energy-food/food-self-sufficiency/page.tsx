import { energyFoodPageMetadata, renderEnergyFoodPage } from "../../../../../../lib/pages/energy-food";
export const generateMetadata = () => energyFoodPageMetadata("en", "food-self-sufficiency");
export default function Page() { return renderEnergyFoodPage("en", "food-self-sufficiency"); }
