export type Locale = "ka" | "en";
export const MESSAGE_SCOPES = ["common", "format", "controls", "main"] as const;
export type MessageScope = (typeof MESSAGE_SCOPES)[number];
export type Messages = Readonly<Record<string, string>>;
export type TemplateValues = Readonly<Record<string, string | number>>;

export type ReviewedText = { text: string; reviewedAt: string };
export type EnglishCatalogue = {
  labels: Record<string, ReviewedText>;
  programmeHistory: Record<string, Record<string, ReviewedText & { originalKa: string }>>;
  sources: Record<string, { name: ReviewedText; derivation: ReviewedText | null }>;
  documents: Record<string, {
    title: ReviewedText;
    publisher: ReviewedText;
    attribution: ReviewedText | null;
    documentLanguage: "ka" | "en" | "mul" | null;
  }>;
};

export type TranslationInventory = {
  pagePaths: string[];
  labelIds: string[];
  sourceIds: string[];
  documentIds: string[];
  derivedSourceIds: string[];
  attributedDocumentIds: string[];
  programmeHistory: Array<{ seriesId: string; year: number; originalKa: string }>;
};

export type Presentation = {
  locale: Locale;
  englishLabels: Readonly<Record<string, string>>;
  messages: Messages;
};
