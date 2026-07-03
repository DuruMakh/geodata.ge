export type HierarchyContext = {
  institutionCode: string | null;
  institutionLabelKa: string | null;
  programCode: string | null;
  programLabelKa: string | null;
  subprogramCode: string | null;
  subprogramLabelKa: string | null;
};

export function contextFor(
  code: string | null,
  rowsByCode: Map<string, { labelKa: string }>,
): HierarchyContext {
  if (!code) {
    return {
      institutionCode: null,
      institutionLabelKa: null,
      programCode: null,
      programLabelKa: null,
      subprogramCode: null,
      subprogramLabelKa: null,
    };
  }

  const parts = code.split(" ");
  const institutionCode = parts.length >= 2 ? `${parts[0]} 00` : null;
  const programCode = parts.length >= 2 && parts[1] !== "00" ? `${parts[0]} ${parts[1]}` : null;
  const subprogramCode = parts.length >= 3 ? `${parts[0]} ${parts[1]} ${parts[2]}` : null;

  return {
    institutionCode,
    institutionLabelKa: institutionCode ? rowsByCode.get(institutionCode)?.labelKa ?? null : null,
    programCode,
    programLabelKa: programCode ? rowsByCode.get(programCode)?.labelKa ?? null : null,
    subprogramCode,
    subprogramLabelKa: subprogramCode ? rowsByCode.get(subprogramCode)?.labelKa ?? null : null,
  };
}
