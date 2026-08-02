// Row shapes for the municipal dataset. No logic here — every loader in
// lib/data/municipal/ returns one of these, and lib/db/mirrorRows.ts returns
// the identical shapes so parity compares like with like.

export type MunicipalFunction = {
  id: string;
  kaLabel: string;
  functionalCode: string;
  sortOrder: number;
};

export type MunicipalRegion = {
  id: string;
  kaLabel: string;
  sortOrder: number;
};
