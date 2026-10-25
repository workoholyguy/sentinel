import type { FaultCode, FixPlugin } from "../../types";
import { recordCommand } from "../exec";
import type { FaultFixContext } from "../util";

const id = "router-reboot";
export const ROUTER_REBOOT_SIMULATED = "Rebooted router (simulated)";
const ISP_FAULTS: FaultCode[] = ["ISP_UPSTREAM_LOSS", "ISP_OUTAGE"];

/** No real router API exists: simulated in dryRun or when UPLINK_DEMO=1, otherwise a no-op failure. */
export const routerReboot: FixPlugin = {
  id,
  title: "Reboot the office router (simulated)",
  handles: ["GATEWAY_UNREACHABLE", "ISP_UPSTREAM_LOSS", "ISP_OUTAGE"],
  platforms: ["darwin", "linux"],
  async run(ctx: FaultFixContext) {
    if (!ctx.dryRun && process.env.UPLINK_DEMO !== "1") {
      return { pluginId: id, ok: false, actions: [], detail: "No router API configured; reboot the router manually" };
    }
    recordCommand(ROUTER_REBOOT_SIMULATED);
    const actions = [ROUTER_REBOOT_SIMULATED];
    if (ctx.fault && ISP_FAULTS.includes(ctx.fault)) {
      return { pluginId: id, ok: false, actions, detail: "Loss persisted after reboot" };
    }
    return { pluginId: id, ok: true, actions, detail: "Router back online" };
  },
};

export default routerReboot;
