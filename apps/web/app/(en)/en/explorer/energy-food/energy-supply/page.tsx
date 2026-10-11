import { energyFoodPageMetadata, renderEnergyFoodPage } from "../../../../../../lib/pages/energy-food";
export const generateMetadata = () => energyFoodPageMetadata("en", "energy-supply");
export default function Page() { return renderEnergyFoodPage("en", "energy-supply"); }
