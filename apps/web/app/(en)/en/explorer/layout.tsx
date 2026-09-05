import type { ReactNode } from "react";
import { renderExplorerLayout } from "../../../../lib/pages/explorer-layout";

export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return renderExplorerLayout("en", children);
}
