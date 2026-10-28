"use client";
import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });
  if (state.status === "sent")
    return (
      <p role="status" className="text-sm text-ink-70">
        {state.message}
      </p>
    );
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm">
        Admin email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base outline-none focus:border-white/45"
      />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-err">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex items-center justify-center gap-3 rounded-full bg-ink px-5 py-3 font-medium text-[#07090c] disabled:opacity-60"
      >
        <i className="dot" aria-hidden="true" />
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
