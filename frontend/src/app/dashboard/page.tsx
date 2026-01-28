import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Welcome to AutoCoach
      </h1>
      <p className="text-gray-600 mb-8">
        Logged in as: <strong>{user.email}</strong>
      </p>
      <LogoutButton />
    </div>
  );
}
