import { describe, expect, it } from "vitest";
import { buildTerrain, elevationAt, formatMetres, LAYERS, PALETTE, renderIndices, ridgeNear } from "./mountains";

const terrain = buildTerrain(160, 80);

describe("buildTerrain", () => {
  it("gives every layer a ridge in every column, inside the footer", () => {
    expect(terrain.ridges).toHaveLength(LAYERS.length);
    for (const ridge of terrain.ridges) {
      expect(ridge).toHaveLength(160);
      for (const y of ridge) {
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(80);
      }
    }
  });

  it("is the same picture every time", () => {
    expect(Array.from(buildTerrain(160, 80).ridges[3])).toEqual(Array.from(terrain.ridges[3]));
  });
});

describe("renderIndices", () => {
  it("paints the sky light and the front mountains dark", () => {
    const px = renderIndices(terrain);
    const at = (x: number, y: number) => px[y * 160 + x];
    expect(px.every((i) => i >= 0 && i < PALETTE.length)).toBe(true);
    const sky = Array.from({ length: 40 }, (_, x) => at(x + 60, 2));
    expect(Math.max(...sky)).toBeLessThanOrEqual(1);
    const ground = Array.from({ length: 40 }, (_, x) => at(x + 60, 79));
    expect(ground.reduce((a, b) => a + b, 0) / ground.length).toBeGreaterThan(4);
  });
});

describe("ridgeNear", () => {
  it("snaps to the visible ridge closest to the pointer", () => {
    const front = terrain.ridges[LAYERS.length - 1][80];
    expect(ridgeNear(terrain, 80, front + 3)).toEqual({ layer: LAYERS.length - 1, y: front });
    const hit = ridgeNear(terrain, 80, 0)!;
    // nothing can be above the topmost visible ridge in that column
    expect(Math.min(...terrain.ridges.map((r) => r[80]))).toBe(hit.y);
  });
});

describe("elevation", () => {
  it("is higher further up and reads like a survey label", () => {
    expect(elevationAt(10, 80)).toBeGreaterThan(elevationAt(60, 80));
    expect(formatMetres(2113)).toBe("2,113 m");
  });
});
