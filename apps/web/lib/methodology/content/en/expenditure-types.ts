import type { MethodologyContent } from "../../types";
export const EXPENDITURE_TYPES_METHODOLOGY: MethodologyContent = {
  id:"expenditure-types",slug:"expenditure-types",title:"Spending by type",
  summary:"What kinds of things general government spends on: wages, goods and services, interest, subsidies, social benefits and investment.",
  reviewedAt:"2026-10-21",archiveManifestId:"expenditure-types",coverageSource:{kind:"archive"},
  canonicalDocuments:["docs/data-methodology/expenditure-types.md"],
  disclosure:"Official annual Ministry of Finance observations. Fiscal.ge calculates the shares of GDP.",
  keyFacts:[{label:"Coverage",valueKind:"coverage"},{label:"Frequency",valueKind:"frequency",value:"Annual"},{label:"Unit",valueKind:"unit",value:"GEL / %"}],
  sections:[
    {id:"scope",kind:"scope",title:"Scope",paragraphs:["General government: the state budget, the autonomous republics of Adjara and Abkhazia and the municipalities, consolidated so that transfers between them count once. 2002–2025, annual figures only.","Total spending = running costs + net purchases of buildings, roads and other assets. Running costs = wages and salaries + goods and services + interest + subsidies + grants + social benefits + other costs."]},
    {id:"sources",kind:"sources",title:"Sources and calculations",paragraphs:["The source is the Ministry of Finance file “General Government Operations” (general20022025.xlsx, GFSM 2001), in million GEL with one decimal. Share of GDP = amount / same year’s GDP × 100, using the GDP the other Budget pages use.","The Ministry also publishes a GFSM 2014 file. From 2013 it counts more public bodies, such as universities and agencies with their own income, so its total is larger (2025: 33.1 billion ₾ instead of 29.7). We use the file whose tax revenue matches the Revenue page in every year."]},
    {id:"limitations",kind:"limitations",title:"Limitations",paragraphs:["This total differs from the Spending page, which shows every state-budget payment, including debt repayment and lending, and not the municipalities.","The Ministry’s file also has a budget balance, which we do not show: the Deficit page keeps the IMF figure so the site never shows two deficits for one year.","2025 GDP is preliminary, so the 2025 shares are marked preliminary. The Ministry may revise earlier years."]},
    {id:"archive",kind:"archive",title:"Original source",paragraphs:["The Ministry of Finance’s unaltered Excel file."]},
  ],decisions:[],technicalAppendix:[],showTechnicalAppendix:false,
};
