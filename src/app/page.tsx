import { RecentWorkbooks } from "@/components/upload/recent-workbooks";
import { SampleGallery } from "@/components/upload/sample-gallery";
import { UploadDropzone } from "@/components/upload/upload-dropzone";

export default function UploadPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Excel Table Studio</h1>
        <p className="mt-2 text-muted-foreground">
          Upload a workbook — we detect every table on every sheet, infer column types, and let you
          review and correct the results.
        </p>
      </header>

      <UploadDropzone />
      <RecentWorkbooks />
      <SampleGallery />
    </main>
  );
}
