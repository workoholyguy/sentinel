import { NextResponse } from "next/server";
import { mockStatus } from "@/lib/mock";
import type { StatusResponse } from "@/lib/types";

// Integrator-owned. Returns mock data until the orchestrator is wired in.
export const dynamic = "force-dynamic";

export async function GET() {
  const body: StatusResponse = { ...mockStatus, snapshot: { ...mockStatus.snapshot, at: new Date().toISOString() } };
  return NextResponse.json(body);
}
