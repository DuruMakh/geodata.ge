import { expect, test, vi } from "vitest";
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), useState: () => [0, () => {}] }));
import { renderToStaticMarkup } from "react-dom/server";
import { EditorialLineChart } from "../../components/main-explorer/editorial-line-chart";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import { formatAmount } from "../../lib/explorer/format";
test("sector nominal tooltip can show standalone amount and currency",async()=>{
  const html=renderToStaticMarkup(<I18nProvider locale="en" messages={await getMessages("en",["controls"])}>
    <EditorialLineChart years={[2025]} series={[{id:"sector.t",label:"Households",color:"#1E1B16",vals:[86354085.57338411],planned:[false]}]} share={false} unit={{divisor:1e9,label:"bn GEL",decimals:2}} shareLabel="%" formatTooltipValue={value=>formatAmount(value,"en")}/>
  </I18nProvider>);
  expect(html).toContain("86.4 mln GEL");
});
