import { NextResponse } from "next/server";
import { ensureRunning } from "@/lib/uplink";
import { state } from "@/lib/store";
import { endOutage, outageActive, SETUP_COMMAND, startOutage } from "@/lib/outage";

export const dynamic = "force-dynamic";

// Real outage for the demo: POST { "on": true } cuts everything past the router; { "on": false } restores it.
export async function POST(req: Request) {
  ensureRunning();
  const { on } = (await req.json().catch(() => ({}))) as { on?: boolean };
  const result = on === false ? await endOutage() : await startOutage();
  if (on !== false && result.ok) state().providerCalledAt = undefined; // a fresh demo run may call again
  if (!result.ok) return NextResponse.json({ ...result, setup: result.needsSetup ? SETUP_COMMAND : undefined }, { status: result.needsSetup ? 403 : 500 });
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({ active: outageActive() });
}
