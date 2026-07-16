import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getSessionUser()) redirect(next && next.startsWith("/") ? next : "/");

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">AMPulse</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live advertising analytics</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
