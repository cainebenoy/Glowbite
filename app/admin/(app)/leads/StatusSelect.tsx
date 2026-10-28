"use client";
import { useTransition } from "react";
import { setLeadStatus } from "../actions";
import { STATUSES } from "@/lib/lead-status";

export function StatusSelect({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Status"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("status", e.target.value);
        start(() => setLeadStatus(fd));
      }}
      className="rounded-lg border border-white/15 bg-panel px-2 py-1 text-sm disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
