import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const allowed = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!allowed || user.email?.toLowerCase() !== allowed) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=unauthorized");
  }
  return user;
}
