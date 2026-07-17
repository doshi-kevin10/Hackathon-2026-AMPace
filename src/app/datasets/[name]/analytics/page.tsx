import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CompanyView } from "@/components/company-view";
import { getSessionUser } from "@/lib/auth/server";

export default async function CompanyAnalyticsPage({ params }: { params: Promise<{ name: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { name } = await params;

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <AppHeader user={user} />
      <CompanyView key={name} name={name} initialTab="analytics" />
    </div>
  );
}
