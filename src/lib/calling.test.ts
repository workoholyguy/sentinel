import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { callingEnabled, setCalling } from "./calling";
import { isLiveCalling, startDebrief } from "./call";
import type { Incident } from "./types";
import { demoProfile } from "./profile";

const live = { VAPI_API_KEY: "k", VAPI_PHONE_NUMBER_ID: "p", UPLINK_SUPPORT_NUMBER: "+14045550100", UPLINK_CUSTOMER_NUMBER: "+18455550394" };
const before = process.env.UPLINK_CALLING_FILE;
afterEach(() => {
  process.env.UPLINK_CALLING_FILE = before;
});

describe("the calling switch", () => {
  it("is on until someone turns it off, and stays off across restarts", () => {
    process.env.UPLINK_CALLING_FILE = join(mkdtempSync(join(tmpdir(), "uplink-")), "calling");
    expect(callingEnabled()).toBe(true);
    setCalling(false);
    expect(callingEnabled()).toBe(false); // read back from the file, as a restarted server would
    setCalling(true);
    expect(callingEnabled()).toBe(true);
  });

  it("off: no live calls, and no customer update is dialed", async () => {
    process.env.UPLINK_CALLING_FILE = join(mkdtempSync(join(tmpdir(), "uplink-")), "calling");
    expect(isLiveCalling(live)).toBe(true);
    setCalling(false);
    expect(isLiveCalling(live)).toBe(false);
    expect(await startDebrief({ id: "inc" } as Incident, demoProfile, live)).toBeNull();
  });
});
