import { WorkbookView } from "@/components/workbook/workbook-view";

export default async function WorkbookPage({
  params,
}: {
  params: Promise<{ workbookId: string }>;
}) {
  const { workbookId } = await params;
  return <WorkbookView workbookId={workbookId} />;
}
