// The calling switch. On: Uplink phones the provider and the customer for real, and the cloud watchdog stands by.
// Off: no phone rings — calls fall back to the scripted mock, and the cloud has no call to place. Saved to a file,
// so a restart (or a closed lid) never turns calling back on by surprise. No file: on, as .env.local configures.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = () => process.env.UPLINK_CALLING_FILE || join(process.cwd(), ".uplink-calling");

export function callingEnabled(): boolean {
  try {
    return readFileSync(file(), "utf8").trim() !== "off";
  } catch {
    return true;
  }
}

export function setCalling(on: boolean): void {
  writeFileSync(file(), on ? "on\n" : "off\n");
}
