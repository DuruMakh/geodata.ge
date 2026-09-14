import { queryEconomicSectorsInput } from "./schemas";
import { buildResponseMeta } from "./meta";
import { buildObservationId, caveatIdsForObservation, countryLevelCaveatContext, resolveDocumentIds, type Observation } from "./observations";
import { CAVEAT_RULES, evaluateCaveats } from "./caveats";
import { serviceMessage } from "./localization";
import { selectSources } from "./sources";
import { SECTOR_QUERY_MEASURES } from "./economicSectorsSeries";
import type { FactQueryResponse, FactQuerySnapshot } from "./types";

export function queryEconomicSectors(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const error = (code: string, messageEn: string, messageKa = "მოთხოვნა არ შეესაბამება ეკონომიკური სექტორების მონაცემებს. გადაამოწმეთ სერიები, წლები და მაჩვენებელი."): FactQueryResponse => ({ kind:"error",status:"error",error:{code,messageKa,messageEn,retryable:false},meta:buildResponseMeta(snapshot) });
  const parsed=queryEconomicSectorsInput.safeParse(rawInput);
  if (!parsed.success) return error("invalid_parameters","Provide sector series IDs, annual years and a supported measure.");
  const input=parsed.data;
  if (input.expectedDataVersion && input.expectedDataVersion!==snapshot.dataVersion) return error("data_version_changed","Data version changed; refresh coverage.","მონაცემების ვერსია შეიცვალა; განაახლეთ მონაცემთა დაფარვის ინფორმაცია.");
  const {facts,registry,definitions}=snapshot.economicSectors;
  const unknownSeriesIds=input.seriesIds.filter(id=>!registry.some(r=>r.id===id));
  if (unknownSeriesIds.length) return {kind:"error",status:"error",error:{code:"unknown_series",messageKa:serviceMessage(snapshot,"ka","errors.unknownSeries",{unknownSeriesIds:unknownSeriesIds.join(", ")}),messageEn:serviceMessage(snapshot,"en","errors.unknownSeries",{unknownSeriesIds:unknownSeriesIds.join(", ")}),retryable:false,validChoices:registry.map(r=>r.id).sort()},meta:buildResponseMeta(snapshot)};
  const allYears=[...new Set(facts.map(f=>f.year))].sort((a,b)=>a-b);
  const growthStart=Math.min(...facts.filter(f=>f.measure==="real_growth").map(f=>f.year));
  if(input.years.some(y=>y<allYears[0]||y>allYears.at(-1)!)) return error("year_out_of_range",`Years must fall within ${allYears[0]}–${allYears.at(-1)}; real growth starts in ${growthStart}.`);
  const measure=SECTOR_QUERY_MEASURES[input.measure];
  const selected=facts.filter(f=>f.measure===measure&&input.seriesIds.includes(f.seriesId)&&input.years.includes(f.year));
  const sources=selectSources(snapshot,[...new Set(selected.map(f=>f.sourceId))]);
  const observations: Observation[]=input.seriesIds.flatMap(seriesId=>input.years.map(year=>{
    const f=selected.find(f=>f.seriesId===seriesId&&f.year===year),r=registry.find(r=>r.id===seriesId)!;
    const definition=seriesId==="economy.gdp_total"?definitions.reference[measure]:definitions[measure];
    return {
      observationId:buildObservationId("economic-sectors","country.georgia",seriesId,year,input.measure),datasetId:"economic-sectors",budgetScope:"national_accounts",
      entityId:"country.georgia",entityType:"country",entityLabelKa:"საქართველო",entityLabelEn:"Georgia",entitySlug:null,
      seriesId,seriesLabelKa:r.labelKa,seriesLabelEn:r.labelEn,level:seriesId==="economy.gdp_total"?"total":"economic_activity",parentSeriesId:null,
      year,measure:input.measure,unit:measure==="nominal"?"GEL":"percent",value:f?Number(f.value):null,availability:f?"available":"missing",
      missingReason:f?null:"ამ წლის შესადარისი მონაცემი ხელმისაწვდომი არ არის.",missingReasonEn:f?null:"Comparable data for this year are unavailable.",basis:f?.status??null,
      valueDefinition:definition.ka,valueDefinitionEn:definition.en,valueDefinitionId:`economic-sectors:${seriesId}:${measure}`,
      sourceIds:f?[f.sourceId]:[],documentIds:f?resolveDocumentIds(sources,[f.sourceId]):[],caveatIds:[],
    };
  }));
  const caveats=evaluateCaveats(snapshot,countryLevelCaveatContext("economic-sectors",input.measure,input.years,input.seriesIds,observations),CAVEAT_RULES);
  for (const o of observations) o.caveatIds=caveatIdsForObservation(caveats,o);
  const available=observations.filter(o=>o.availability==="available");
  return {kind:"observations",status:available.length===observations.length?"ok":available.length?"partial":"empty",data:{observations,coverage:{
    requestedYears:input.years,availableYears:[...new Set(facts.filter(f=>f.measure===measure).map(f=>f.year))].sort((a,b)=>a-b),returnedYears:[...new Set(available.map(o=>o.year))],
    missingCells:observations.filter(o=>o.availability==="missing").map(o=>({entityId:o.entityId,seriesId:o.seriesId,year:o.year,reason:o.missingReason!,reasonEn:o.missingReasonEn!})),
    excludedEntities:[],returnedCount:available.length,expectedCount:observations.length,
  }},meta:buildResponseMeta(snapshot,{sources,citedDocumentIds:[...new Set(observations.flatMap(o=>o.documentIds))],caveats})};
}
