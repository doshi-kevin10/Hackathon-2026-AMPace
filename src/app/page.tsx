import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Dashboard } from "@/components/dashboard";
import { getSessionUser } from "@/lib/auth/server";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-svh">
      <AppHeader user={user} />
      <Dashboard userName={user.name} />
    </div>
  );
}
