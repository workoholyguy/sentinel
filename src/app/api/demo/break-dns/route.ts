import { NextResponse } from "next/server";

// Act 1 of the demo breaks this laptop's real DNS. Wired after the fixes slice merges
// (it needs the sudo rule for networksetup). Until then it is a no-op.
export async function POST() {
  return NextResponse.json({ ok: false, reason: "not wired yet" }, { status: 501 });
}
