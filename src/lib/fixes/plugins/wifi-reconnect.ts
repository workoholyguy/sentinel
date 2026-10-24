import type { FixPlugin } from "../../types";
import { darwinWifiDevice, runSteps, unsupported } from "../util";

const id = "wifi-reconnect";

export const wifiReconnect: FixPlugin = {
  id,
  title: "Power-cycle the Wi-Fi radio to force a reconnect",
  handles: ["WIFI_DISCONNECTED"],
  platforms: ["darwin", "linux"],
  async run(ctx) {
    if (ctx.platform === "darwin") {
      const dev = await darwinWifiDevice(ctx);
      return runSteps(ctx, id, [["networksetup", ["-setairportpower", dev, "off"]], ["networksetup", ["-setairportpower", dev, "on"]]], `Power-cycled Wi-Fi on ${dev}`);
    }
    if (ctx.platform === "linux") {
      return runSteps(ctx, id, [["nmcli", ["radio", "wifi", "off"]], ["nmcli", ["radio", "wifi", "on"]]], "Power-cycled Wi-Fi radio");
    }
    return unsupported(id, ctx);
  },
};

export default wifiReconnect;
