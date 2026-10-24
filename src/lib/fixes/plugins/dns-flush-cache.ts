import type { FixPlugin } from "../../types";
import { runSteps, unsupported } from "../util";

const id = "dns-flush-cache";

export const dnsFlushCache: FixPlugin = {
  id,
  title: "Flush the local DNS resolver cache",
  handles: ["DNS_RESOLVER_DOWN"],
  platforms: ["darwin", "linux"],
  async run(ctx) {
    if (ctx.platform === "darwin") {
      return runSteps(ctx, id, [["dscacheutil", ["-flushcache"]], ["killall", ["-HUP", "mDNSResponder"]]], "Flushed DNS cache");
    }
    if (ctx.platform === "linux") {
      return runSteps(ctx, id, [["resolvectl", ["flush-caches"]]], "Flushed DNS cache");
    }
    return unsupported(id, ctx);
  },
};

export default dnsFlushCache;
