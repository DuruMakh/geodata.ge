import type { MethodologyContent } from "../../types";
export const ECONOMIC_SECTORS_METHODOLOGY: MethodologyContent = {
  id:"economic-sectors",slug:"economic-sectors",title:"Economic sectors",
  summary:"Georgia’s 20 economic activities: nominal value added, share of GDP and annual real growth.",
  reviewedAt:"2026-09-11",archiveManifestId:"economic-sectors",coverageSource:{kind:"archive"},
  canonicalDocuments:["docs/data-methodology/economic-sectors.md"],
  disclosure:"Official annual Geostat observations. Fiscal.ge calculates GDP shares and converts published growth indices to percentage changes.",
  keyFacts:[{label:"Coverage",valueKind:"coverage"},{label:"Frequency",valueKind:"frequency",value:"Annual"},{label:"Unit",valueKind:"unit",value:"GEL / %"}],
  sections:[
    {id:"scope",kind:"scope",title:"Coverage",paragraphs:["National data for 20 NACE Rev. 2 activities (A–T) and Total GDP. Nominal values and GDP shares cover 2010–2025; real growth covers 2011–2025. Regional sectors are excluded."]},
    {id:"sources",kind:"sources",title:"Sources and calculations",paragraphs:["Source: Geostat, SNA 2008. Sector amounts are gross value added at basic prices; the national reference is GDP at market prices.","GDP share = sector value added / same-year market-price GDP × 100. Sector shares need not sum to 100%: GDP also includes taxes on products less subsidies. Selection never changes the denominator.","Annual real growth measures changes in volume, excluding price effects. Subtract 100 from Geostat’s published index (previous year = 100). National growth is separately published; sector growth rates are never added or averaged."]},
    {id:"limitations",kind:"limitations",title:"Limitations",paragraphs:["Compatible sector real-growth data for 2010 are unavailable. Missing values are not zero and are not estimated.","2025 data are preliminary, with revision scheduled for 16 November 2026. The GDP overview’s World Bank growth series can differ slightly from this Geostat series."]},
    {id:"archive",kind:"archive",title:"Original sources",paragraphs:["Untouched Geostat workbooks: current prices, real-growth indices and constant prices for independent validation."]},
  ],decisions:[],technicalAppendix:[],showTechnicalAppendix:false,
};
