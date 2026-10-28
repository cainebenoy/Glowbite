import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "GlowBite admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin min-h-svh text-[15px]">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-black/90 px-5 py-3 backdrop-blur">
        <Link href="/admin" className="font-medium">
          GlowBite admin
        </Link>
        <nav className="flex gap-4 text-ink-70" aria-label="Admin">
          <Link href="/admin" className="hover:text-ink">
            Overview
          </Link>
          <Link href="/admin/leads" className="hover:text-ink">
            Leads
          </Link>
          <Link href="/admin/settings" className="hover:text-ink">
            Settings
          </Link>
          <Link href="/" className="hover:text-ink" target="_blank">
            View site ↗
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-ink-45">
          <span>{admin.email}</span>
          <form action="/admin/auth/signout" method="post">
            <button className="rounded-full border border-white/15 px-3 py-1 text-ink-70 hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
