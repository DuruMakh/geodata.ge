import { methodologyArticleMetadata, methodologyStaticParams, renderMethodologyArticle, type MethodologyDatasetPageProps } from "../../../../lib/pages/methodology-article";

export const dynamicParams = false;
export function generateStaticParams() { return methodologyStaticParams(); }
export function generateMetadata(props: MethodologyDatasetPageProps) { return methodologyArticleMetadata("ka", props); }
export default function MethodologyDatasetPage(props: MethodologyDatasetPageProps) { return renderMethodologyArticle("ka", props); }
