import { NextResponse } from "next/server";
import { ensureRunning, setDemo } from "@/lib/sentinel";
import { endOutage } from "@/lib/outage";

export async function POST() {
  ensureRunning();
  setDemo("none");
  await endOutage().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
