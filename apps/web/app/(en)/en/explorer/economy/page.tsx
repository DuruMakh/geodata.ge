import {
  renderEconomyPage,
  economyPageMetadata,
} from "../../../../../lib/pages/economy";
export function generateMetadata() {
  return economyPageMetadata("en");
}
export default function Page() {
  return renderEconomyPage("en");
}
