import { NextResponse } from "next/server";
import { ensureRunning, setDemo } from "@/lib/sentinel";

// Simulates a fault Uplink has no repair plugin for (an IPv6 blackhole), so it asks Devin to write one.
export async function POST() {
  ensureRunning();
  setDemo("ipv6-blackhole");
  return NextResponse.json({ ok: true });
}
