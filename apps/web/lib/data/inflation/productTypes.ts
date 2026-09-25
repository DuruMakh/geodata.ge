export type ProductMeasure = "mom_index_100" | "yoy_index_100";

export type ProductSourceCell = {
  period: string;
  index100: string | null;
  marker: string | null;
  locator: string;
};

export type ProductSourceRow = {
  year: number;
  ordinal: number;
  coicopCode: string;
  label: string;
  cells: ProductSourceCell[];
};

export type PairedProductRow = {
  year: number;
  ordinal: number;
  coicopCode: string;
  labelEn: string;
  labelKa: string;
  momCells: ProductSourceCell[];
  yoyCells: ProductSourceCell[];
};
