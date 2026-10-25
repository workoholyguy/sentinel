import { NextResponse } from "next/server";
import { ensureRunning, setDemo } from "@/lib/uplink";

// Simulates a provider-side outage (we can't break a real ISP on stage). Shown as "Simulated" in the UI.
export async function POST() {
  ensureRunning();
  setDemo("isp-outage");
  return NextResponse.json({ ok: true });
}
