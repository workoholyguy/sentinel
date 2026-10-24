import { NextResponse } from "next/server";
import type { StatusResponse } from "@/lib/types";
import { state } from "@/lib/store";
import { ensureRunning } from "@/lib/sentinel";
import { demoProfile } from "@/lib/profile";
import { lastDevinRepair } from "@/lib/adapters";

export const dynamic = "force-dynamic";

export async function GET() {
  ensureRunning();
  const s = state();
  const lastRepair = lastDevinRepair(); // never waits on the network
  const body: StatusResponse = { snapshot: s.snapshot, incident: s.incident, history: s.history.slice(0, 10), profile: demoProfile, lastRepair };
  return NextResponse.json(body);
}
