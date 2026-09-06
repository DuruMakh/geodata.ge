import { methodologyArticleMetadata, methodologyStaticParams, renderMethodologyArticle, type MethodologyDatasetPageProps } from "../../../../../lib/pages/methodology-article";

export const dynamicParams = false;
export function generateStaticParams() { return methodologyStaticParams(); }
export function generateMetadata(props: MethodologyDatasetPageProps) { return methodologyArticleMetadata("en", props); }
export default function MethodologyDatasetPage(props: MethodologyDatasetPageProps) { return renderMethodologyArticle("en", props); }
