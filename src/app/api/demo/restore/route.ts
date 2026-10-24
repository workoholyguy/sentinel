import { NextResponse } from "next/server";
import { ensureRunning, setDemo } from "@/lib/sentinel";

export async function POST() {
  ensureRunning();
  setDemo("none");
  return NextResponse.json({ ok: true });
}
