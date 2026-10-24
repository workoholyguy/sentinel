"use client";

import { Building2, Globe, Laptop, Router, Server, Wifi, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import type { Health, NodeId, Probe, Snapshot } from "../../lib/types";
import { NODE_ORDER } from "../../lib/types";
import { HEALTH_HEX, HEALTH_LABEL, NODE_LABEL, failingNode, formatLoss, linkLabel, probeFor } from "./format";

const ICONS: Record<NodeId, LucideIcon> = {
  device: Laptop,
  wifi: Wifi,
  router: Router,
  dns: Server,
  isp: Building2,
  internet: Globe,
};

export function NetworkMap({ snapshot, compact = false }: { snapshot: Snapshot; compact?: boolean }) {
  const failing = failingNode(snapshot.nodes);
  const size = compact ? 84 : 116;

  return (
    <div className="relative flex w-full items-start" data-testid="network-map">
      {NODE_ORDER.map((id, i) => {
        // nodes past the first failure can't be reached, so their reading is unknown
        const health: Health = failing >= 0 && i > failing ? "unknown" : snapshot.nodes[id];
        return (
          <div key={id} className={i === 0 ? "flex" : "flex flex-1"}>
            {i > 0 && (
              <Link
                node={id}
                probe={probeFor(snapshot.probes, id)}
                health={health}
                isFailing={i === failing}
                afterFailure={failing >= 0 && i > failing}
                size={size}
                index={i}
              />
            )}
            <Node id={id} health={health} size={size} compact={compact} />
          </div>
        );
      })}
    </div>
  );
}

function Node({ id, health, size, compact }: { id: NodeId; health: Health; size: number; compact: boolean }) {
  const Icon = ICONS[id];
  const color = HEALTH_HEX[health];
  const down = health === "down";
  return (
    <div className="flex flex-col items-center" style={{ width: size + (compact ? 12 : 24) }} data-testid={`node-${id}`} data-health={health}>
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        {down && (
          <>
            <span className="halo absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 2px ${color}` }} />
            <span className="halo absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 2px ${color}`, animationDelay: "0.9s" }} />
          </>
        )}
        <motion.div
          className="relative grid h-full w-full place-items-center rounded-full"
          animate={{
            boxShadow: `0 0 0 1px ${color}66, 0 0 ${down ? 60 : 36}px -6px ${color}${down ? "aa" : "55"}, inset 0 0 30px -8px ${color}55`,
          }}
          transition={{ duration: 0.8 }}
          style={{ background: `radial-gradient(circle at 50% 35%, ${color}22, #0a0e16 70%)` }}
        >
          <Icon strokeWidth={1.5} style={{ color, width: size * 0.36, height: size * 0.36 }} className={down ? "alarm" : ""} />
        </motion.div>
      </div>
      <div className={`${compact ? "mt-3 text-base" : "mt-5 text-xl"} font-medium tracking-tight text-white/90`}>{NODE_LABEL[id]}</div>
      <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-label" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {HEALTH_LABEL[health]}
      </div>
    </div>
  );
}

function Link({
  node,
  probe,
  health: nodeHealth,
  isFailing,
  afterFailure,
  size,
  index,
}: {
  node: NodeId;
  probe?: Probe;
  health: Health;
  isFailing: boolean;
  afterFailure: boolean;
  size: number;
  index: number;
}) {
  const health: Health = afterFailure ? "unknown" : (probe?.status ?? nodeHealth);
  const color = isFailing ? HEALTH_HEX.down : health === "ok" ? "#38e1ff" : HEALTH_HEX[health];
  const flowing = !afterFailure && health !== "unknown";
  const dur = health === "degraded" ? 3.6 : 2.2;
  const packets = isFailing ? 3 : health === "degraded" ? 2 : 3;
  const loss = probe?.lossPct;

  return (
    <div className="relative mx-1 flex-1" style={{ height: size }} data-testid={`link-${node}`} data-failing={isFailing || undefined}>
      <div
        className={`absolute inset-x-0 top-[calc(50%-30px)] text-center font-mono text-[13px] tabular ${isFailing ? "alarm" : ""}`}
        style={{ color: isFailing ? HEALTH_HEX.down : health === "ok" ? "rgb(255 255 255 / 0.7)" : color }}
      >
        {afterFailure ? "—" : linkLabel(probe)}
      </div>
      {!afterFailure && loss != null && (
        <div
          className={`absolute inset-x-0 top-[calc(50%+14px)] text-center font-mono text-[11px] tabular ${isFailing ? "alarm" : ""}`}
          style={{ color: loss > 0 ? color : "rgb(255 255 255 / 0.35)" }}
        >
          {formatLoss(loss)}
        </div>
      )}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2">
        <div
          className={`absolute inset-0 ${isFailing ? "alarm" : ""}`}
          style={{
            background: afterFailure
              ? "repeating-linear-gradient(90deg, #5b657766 0 6px, transparent 6px 12px)"
              : `linear-gradient(90deg, ${color}22, ${color}aa 50%, ${color}22)`,
            height: isFailing ? 2 : 1,
            boxShadow: isFailing ? `0 0 16px ${color}` : undefined,
          }}
        />
        {flowing &&
          Array.from({ length: packets }).map((_, k) => (
            <span
              key={k}
              className={`packet ${isFailing ? "packet-drop" : ""} h-1.5 w-1.5 rounded-full`}
              style={
                {
                  background: color,
                  boxShadow: `0 0 10px 2px ${color}`,
                  "--dur": `${dur}s`,
                  "--delay": `${(k * dur) / packets + index * 0.17}s`,
                } as React.CSSProperties
              }
            />
          ))}
        {isFailing && (
          <span className="alarm absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-lg font-semibold text-bad">
            ✕
          </span>
        )}
      </div>
    </div>
  );
}
