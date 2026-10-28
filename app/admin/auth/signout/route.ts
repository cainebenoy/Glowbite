import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

async function signOut(request: Request) {
  const url = new URL(request.url);
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  const error = url.searchParams.get("error");
  return NextResponse.redirect(new URL(`/admin/login${error ? `?error=${encodeURIComponent(error)}` : ""}`, url.origin), 303);
}

export const GET = signOut;
export const POST = signOut;
