import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { DatasetView } from "@/components/dataset-view";
import { getSessionUser } from "@/lib/auth/server";

export default async function DatasetPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { name } = await params;

  return (
    <div className="min-h-svh">
      <AppHeader user={user} />
      <DatasetView name={name} />
    </div>
  );
}
