import type { MethodologyContent } from "../../types";
export const TAX_BREAKS_REFUNDS_METHODOLOGY: MethodologyContent = {
  id:"tax-breaks-refunds",slug:"tax-breaks-refunds",title:"Tax breaks and refunds",
  summary:"How much tax the state gives up through tax breaks, and how much overpaid tax the State Treasury pays back.",
  reviewedAt:"2026-10-21",archiveManifestId:"tax-breaks-refunds",coverageSource:{kind:"archive"},
  canonicalDocuments:["docs/data-methodology/tax-breaks-refunds.md"],
  disclosure:"Official annual figures from the Ministry of Finance and the State Treasury. Fiscal.ge calculates the shares of GDP. Tax breaks and refunds are different things and must not be added together.",
  keyFacts:[{label:"Coverage",valueKind:"coverage"},{label:"Frequency",valueKind:"frequency",value:"Annual"},{label:"Unit",valueKind:"unit",value:"million GEL / % of GDP"}],
  sections:[
    {id:"scope",kind:"scope",title:"Coverage",paragraphs:[
      "A tax break (the Ministry of Finance calls it a “tax expenditure”) is tax the state does not collect because of an exemption, a zero rate or a special regime. Under a VAT exemption the seller charges no VAT but cannot reclaim the VAT it paid on purchases; under a zero rate it charges no VAT and can reclaim it. Tax breaks are shown for 2018–2024: the total, VAT (in eight areas) and income and profit tax (in four parts).",
      "A tax refund is overpaid tax, mostly VAT, that the State Treasury pays back to taxpayers. Refunds are shown for 2008–2025.",
      "Tax breaks and refunds are different things: the first is an estimate of what was not collected, the second is money actually paid back. The page therefore never adds them together."]},
    {id:"sources",kind:"sources",title:"Sources and calculations",paragraphs:[
      "Tax breaks: the Ministry of Finance's Tax Expenditure Report, 2024 edition, Georgian Excel workbook. Each edition revises earlier years, so only the latest is used. The English workbook is not used because its income and profit tax row is out of date (2023: 406.1 rather than 432.1 million GEL).",
      "The Ministry estimates each area's VAT break on its own, other things being equal. “Other VAT breaks” is the remainder, so the eight rows add up to the VAT total.",
      "Refunds: the chart data on the State Treasury's website, as of 21 October 2026. The 2007 figure (1 million GEL) looks like an incomplete first year and is not shown; the 2026 year-to-date figure is not shown either, because the site shows whole years only.",
      "Share of GDP = amount / GDP of the same year × 100, using the site's one GDP series (the same as on the Revenue, Debt and Money pages). Total tax breaks were 6.9% of GDP in 2024; the Ministry printed 7.0% because it used GDP from before Geostat's revision. 2025 GDP is preliminary."]},
    {id:"limitations",kind:"limitations",title:"Limitations",paragraphs:[
      "In the Ministry's table, the 2024 figure for “full deduction of assets” repeats the 2018 figure exactly (9.41 million GEL). It sits inside “Other income and profit tax breaks” and is shown as published.",
      "The Ministry notes that VAT revenue is counted net of VAT refunds. Refunds are not published by type of tax."]},
    {id:"archive",kind:"archive",title:"Original sources",paragraphs:["The Ministry report's Georgian and English Excel and PDF files and the Treasury chart's XML file, unchanged."]},
  ],
  decisions:[
    {id:"tax-breaks-refunds.two_totals",group:"tax-breaks-refunds",title:"Why does the chart open with two lines?",statusLabel:"Fiscal.ge decision",summary:"The page has two independent totals, tax breaks and refunds, so both are selected when it opens. Either can be removed.",detail:[],canonicalDecisionIds:["tax-breaks-refunds.two_totals"]},
    {id:"tax-breaks-refunds.georgian_workbook",group:"tax-breaks-refunds",title:"Which file is used?",statusLabel:"Fiscal.ge decision",summary:"Only the Georgian Excel workbook of the latest, 2024 edition of the Ministry's report, because one row of the English workbook is out of date.",detail:[],canonicalDecisionIds:["tax-breaks-refunds.georgian_workbook"]},
    {id:"tax-breaks-refunds.refunds_from_2008",group:"tax-breaks-refunds",title:"Why do refunds start in 2008?",statusLabel:"Fiscal.ge decision",summary:"The Treasury's 1 million GEL for 2007 looks like an incomplete first year, so it is not shown.",detail:[],canonicalDecisionIds:["tax-breaks-refunds.refunds_from_2008"]},
    {id:"tax-breaks-refunds.gdp_share",group:"tax-breaks-refunds",title:"Which GDP are the shares based on?",statusLabel:"Fiscal.ge decision",summary:"The site's one GDP series, so 2024 tax breaks are 6.9% of GDP rather than the Ministry's 7.0%.",detail:[],canonicalDecisionIds:["tax-breaks-refunds.gdp_share"]},
  ],technicalAppendix:[],showTechnicalAppendix:false,
};
