import type { FixPlugin } from "../../types";
import { formatCommand } from "../exec";
import { darwinWifiDevice, defaultInterface, linuxInterface, runSteps, unsupported } from "../util";

const id = "dhcp-renew";

export const dhcpRenew: FixPlugin = {
  id,
  title: "Renew the DHCP lease on the active interface",
  handles: ["DHCP_NO_LEASE"],
  platforms: ["darwin", "linux"],
  async run(ctx) {
    if (ctx.platform === "darwin") {
      const iface = (await defaultInterface(ctx)) ?? (await darwinWifiDevice(ctx));
      return runSteps(ctx, id, [["ipconfig", ["set", iface, "DHCP"]]], `Renewed DHCP lease on ${iface}`);
    }
    if (ctx.platform === "linux") {
      const iface = await linuxInterface(ctx);
      const actions: string[] = [];
      // Prefer NetworkManager; fall back to dhclient when nmcli is missing or has no connection.
      const conArgs = ["-t", "-f", "NAME,DEVICE", "connection", "show", "--active"];
      const cons = await ctx.exec("nmcli", conArgs);
      if (cons.code === 0) {
        actions.push(formatCommand("nmcli", conArgs));
        const name = cons.stdout
          .split("\n")
          .map((l) => l.split(":"))
          .find((parts) => parts[parts.length - 1] === iface)
          ?.slice(0, -1)
          .join(":");
        if (name || ctx.dryRun) {
          const up = await runSteps(ctx, id, [["nmcli", ["con", "up", name ?? iface]]], `Renewed DHCP lease on ${iface} via NetworkManager`, actions);
          if (up.ok) return up;
        }
      }
      return runSteps(ctx, id, [["dhclient", ["-r", iface]], ["dhclient", [iface]]], `Renewed DHCP lease on ${iface} via dhclient`, actions);
    }
    return unsupported(id, ctx);
  },
};

export default dhcpRenew;
