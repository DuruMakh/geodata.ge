import {
  renderEconomyPage,
  economyPageMetadata,
} from "../../../../lib/pages/economy";
export function generateMetadata() {
  return economyPageMetadata("ka");
}
export default function Page() {
  return renderEconomyPage("ka");
}
