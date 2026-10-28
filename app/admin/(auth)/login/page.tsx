import type { Metadata } from "next";
import Image from "next/image";
import logo from "@/public/logo.png";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  not_authorised: "This email isn't authorised for the admin area. You've been signed out.",
  link_invalid: "That sign-in link is invalid or has expired. Request a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-5">
      <Image src={logo} alt="GlowBite" style={{ width: 110, height: "auto" }} sizes="110px" />
      <h1 className="text-3xl font-extralight tracking-tight">Admin sign-in</h1>
      {error && ERRORS[error] && (
        <p role="alert" className="rounded-xl border border-err/40 bg-err/10 px-4 py-3 text-sm text-err">
          {ERRORS[error]}
        </p>
      )}
      <LoginForm />
      <p className="text-xs text-ink-45">No sign-up. Ask an existing admin to add your email.</p>
    </main>
  );
}
