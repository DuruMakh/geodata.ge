import type { SectorMeasure } from "../data/economicSectors/types";
export const SECTOR_QUERY_MEASURES = {
  amount_gel: "nominal", share_of_gdp_pct: "share_of_gdp", real_growth_pct: "real_growth",
} as const satisfies Record<string, SectorMeasure>;
export const SECTOR_DEFINITIONS = {
  reference: {
    nominal: {ka:"მთლიანი მშპ საბაზრო ფასებში, მიმდინარე ლარში; მოიცავს პროდუქციაზე გადასახადებს სუბსიდიების გამოკლებით.",en:"Total GDP at market prices in current GEL, including taxes on products less subsidies."},
    share_of_gdp: {ka:"მთლიანი მშპ / იმავე წლის მთლიანი მშპ × 100 = 100%, როდესაც მნიშვნელი დადებითია. არ არის სექტორული დამატებული ღირებულების წილი.",en:"Total GDP / same-year GDP × 100 = 100% when the denominator is positive. This is the national reference, not a sector GVA share."},
    real_growth: {ka:"საქსტატის ცალკე გამოქვეყნებული მთლიანი მშპ-ის წლიური რეალური ზრდა; ინდექსი (წინა წელი = 100) მინუს 100. არ არის სექტორების ზრდის ჯამი.",en:"Separately published annual real GDP growth: Geostat index (previous year = 100) minus 100. It is not summed sector growth; 7.5 means7.5%."},
  },
  nominal: { ka: "სექტორის მთლიანი დამატებული ღირებულება საბაზისო ფასებში, მიმდინარე ლარში; მთლიანი მშპ — საბაზრო ფასებში.", en: "Sector gross value added at basic prices in current GEL; Total GDP is at market prices." },
  share_of_gdp: { ka: "სექტორის დამატებული ღირებულება / იმავე წლის მთლიანი მშპ საბაზრო ფასებში × 100. წილები არ არის შერჩეული სექტორების ჯამის წილი.", en: "Sector GVA / same-year market-price GDP × 100. Shares use all national GDP, not selected sectors; sector shares need not sum to 100%." },
  real_growth: { ka: "წლიური რეალური მოცულობის ცვლილება: საქსტატის ინდექსი (წინა წელი = 100) მინუს 100. 7.5 ნიშნავს 7.5%-ს. ზრდის ტემპები არ ჯამდება.", en: "Annual real volume change: Geostat index (previous year = 100) minus 100. 7.5 means 7.5%, not a fraction, GDP share or contribution. Rates are not summed." },
};
