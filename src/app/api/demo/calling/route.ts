import { NextResponse } from "next/server";
import { ensureRunning } from "@/lib/sentinel";
import { callingEnabled, setCalling } from "@/lib/calling";
import { disarm, heartbeat } from "@/lib/watchdog";

export const dynamic = "force-dynamic";

// The calling switch: POST { "on": false } — no phone rings, and the cloud is told right away; { "on": true } — real calls again.
export async function POST(req: Request) {
  ensureRunning();
  const { on } = (await req.json().catch(() => ({}))) as { on?: boolean };
  setCalling(on !== false);
  await heartbeat(true); // the cloud's copy of the call to place is replaced now (with none, when off)
  if (on === false) await disarm(process.env, true);
  return NextResponse.json({ on: callingEnabled() });
}

export async function GET() {
  return NextResponse.json({ on: callingEnabled() });
}
