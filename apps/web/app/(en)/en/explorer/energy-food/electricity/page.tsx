import { energyFoodPageMetadata, renderEnergyFoodPage } from "../../../../../../lib/pages/energy-food";
export const generateMetadata = () => energyFoodPageMetadata("en", "electricity");
export default function Page() { return renderEnergyFoodPage("en", "electricity"); }
