import type { ReactNode } from "react";
import { DataSidebar } from "../../components/shell/data-sidebar";
import { SiteFooter } from "../../components/site/site-footer";
import { loadServedLandingData } from "../../lib/data/servedData";
import { buildLandingModel } from "../../lib/landing/landingData";

// Explorer shell (DESIGN.md §6.7). A flex row rather than a fixed grid: the
// sidebar owns its own width, so collapsing it reflows the content with no
// shared state between the two.
//
// The footer belongs inside the content column, not beside the sidebar, and it
// carries the licence, the contact address and — under the owner's navigation
// design — the only link to the methodology these ~85 routes have. Its padding
// matches the pages' own so the rule lines up with the content above it.
export default async function ExplorerLayout({ children }: { children: ReactNode }) {
  const { updatedAt } = buildLandingModel(await loadServedLandingData());

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)] min-[900px]:flex-row">
      <DataSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <div className="px-5 min-[768px]:px-[34px]">
          <div className="mx-auto max-w-[1180px]">
            <SiteFooter updatedAt={updatedAt} />
          </div>
        </div>
      </div>
    </div>
  );
}
