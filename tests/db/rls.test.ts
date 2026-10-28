// Proves the data model's access rules against local Supabase (pnpm db:start && pnpm db:reset first).
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

let anon: SupabaseClient;
let service: SupabaseClient;
let leadId: string;
const PHONE = "+919000000001";

beforeAll(async () => {
  if (!url || !anonKey || !serviceKey) throw new Error("Supabase env missing: copy keys from `pnpm supabase status` into .env.local");
  anon = createClient(url, anonKey, opts);
  service = createClient(url, serviceKey, opts);
  await service.from("leads").delete().eq("phone", PHONE);
  const { data, error } = await service
    .from("leads")
    .insert({ full_name: "RLS Probe", phone: PHONE, pin_code: "682001", consent_text_version: "test" })
    .select("id")
    .single();
  if (error) throw error;
  leadId = data.id;
});

afterAll(async () => {
  await service?.from("leads").delete().eq("phone", PHONE);
});

describe("leads (private)", () => {
  it("anon cannot select", async () => {
    const { data, error } = await anon.from("leads").select("*");
    expect(error?.code ?? (data?.length === 0 ? "empty" : "rows")).not.toBe("rows");
    expect(data ?? []).toHaveLength(0);
  });
  it("anon cannot insert", async () => {
    const { error } = await anon
      .from("leads")
      .insert({ full_name: "Anon Insert", phone: "+919000000002", pin_code: "682001", consent_text_version: "test" });
    expect(error).not.toBeNull();
    const { data } = await service.from("leads").select("id").eq("phone", "+919000000002");
    expect(data).toHaveLength(0);
  });
  it("anon cannot update", async () => {
    await anon.from("leads").update({ status: "dropped" }).eq("id", leadId);
    const { data } = await service.from("leads").select("status").eq("id", leadId).single();
    expect(data!.status).toBe("new");
  });
  it("anon cannot delete", async () => {
    await anon.from("leads").delete().eq("id", leadId);
    const { data } = await service.from("leads").select("id").eq("id", leadId);
    expect(data).toHaveLength(1);
  });
  it("the database rejects malformed phone and PIN even for the service role", async () => {
    const bad = await service.from("leads").insert({ full_name: "Bad", phone: "9876543210", pin_code: "682001", consent_text_version: "t" });
    expect(bad.error?.code).toBe("23514");
    const badPin = await service.from("leads").insert({ full_name: "Bad", phone: "+919000000003", pin_code: "012345", consent_text_version: "t" });
    expect(badPin.error?.code).toBe("23514");
  });
  it("phone is unique", async () => {
    const dup = await service.from("leads").insert({ full_name: "Dup", phone: PHONE, pin_code: "682001", consent_text_version: "t" });
    expect(dup.error?.code).toBe("23505");
  });
});

describe("settings (public content)", () => {
  it("anon can select", async () => {
    const { data, error } = await anon.from("settings").select("data").eq("id", 1).single();
    expect(error).toBeNull();
    expect(data!.data).toHaveProperty("brand_name");
  });
  it("anon cannot update", async () => {
    const before = await service.from("settings").select("data").eq("id", 1).single();
    await anon.from("settings").update({ data: { brand_name: "Hacked" } }).eq("id", 1);
    const after = await service.from("settings").select("data").eq("id", 1).single();
    expect(after.data!.data).toEqual(before.data!.data);
  });
  it("anon cannot insert", async () => {
    const { error } = await anon.from("settings").insert({ id: 2, data: {} });
    expect(error).not.toBeNull();
  });
});

describe("private tables", () => {
  it.each(["settings_ops", "admins", "rate_limits"])("anon cannot read %s", async (table) => {
    const { data } = await anon.from(table).select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("anon cannot call the rate-limit function", async () => {
    const { error } = await anon.rpc("check_rate_limit", { p_ip_hash: "x", p_max: 5, p_window_seconds: 600 });
    expect(error).not.toBeNull();
  });
  it("rate limit allows 5 then refuses", async () => {
    const hash = `test-${Date.now()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const { data, error } = await service.rpc("check_rate_limit", { p_ip_hash: hash, p_max: 5, p_window_seconds: 600 });
      expect(error).toBeNull();
      results.push(data as boolean);
    }
    expect(results).toEqual([true, true, true, true, true, false]);
    await service.from("rate_limits").delete().eq("ip_hash", hash);
  });
});
