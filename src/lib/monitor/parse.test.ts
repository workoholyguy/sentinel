import { describe, expect, it } from "vitest";
import { darwin, linux } from "./fixtures";
import {
  firstPublicHop,
  isPrivateIp,
  parseAirportNetwork,
  parseDefaultGateway,
  parseIpconfigSummary,
  parseIwDev,
  parseNmcliWifi,
  parsePing,
  parseTraceroute,
} from "./parse";

describe("parsePing", () => {
  it("parses Linux iputils summaries", () => {
    expect(parsePing(linux.pingOk)).toEqual({ sent: 3, received: 3, lossPct: 0, avgMs: 7.067 });
    expect(parsePing(linux.pingPartial)).toEqual({ sent: 3, received: 2, lossPct: 33.3333, avgMs: 192.114 });
    expect(parsePing(linux.pingDead)).toEqual({ sent: 3, received: 0, lossPct: 100, avgMs: undefined });
  });
  it("parses macOS summaries", () => {
    expect(parsePing(darwin.pingOk)).toEqual({ sent: 3, received: 3, lossPct: 0, avgMs: 3.402 });
    expect(parsePing(darwin.pingPartial)).toEqual({ sent: 3, received: 2, lossPct: 33.3, avgMs: 412.058 });
    expect(parsePing(darwin.pingDead)).toEqual({ sent: 3, received: 0, lossPct: 100, avgMs: undefined });
  });
  it("returns null for garbage", () => {
    expect(parsePing("ping: unknown host nope")).toBeNull();
  });
});

describe("parseDefaultGateway", () => {
  it("reads Linux ip route", () => {
    expect(parseDefaultGateway("linux", linux.routeDefault)).toEqual({ ip: "172.16.255.1", iface: "ens5" });
    expect(parseDefaultGateway("linux", linux.routeDefaultDhcp)).toEqual({ ip: "192.168.1.1", iface: "wlp2s0" });
    expect(parseDefaultGateway("linux", linux.routeNone)).toBeNull();
  });
  it("reads macOS route get", () => {
    expect(parseDefaultGateway("darwin", darwin.routeDefault)).toEqual({ ip: "192.168.1.1", iface: "en0" });
    expect(parseDefaultGateway("darwin", darwin.routeNone)).toBeNull();
  });
});

describe("wifi parsers", () => {
  it("macOS networksetup", () => {
    expect(parseAirportNetwork(darwin.airportConnected)).toEqual({ state: "connected", ssid: "HackerHouse HQ" });
    expect(parseAirportNetwork(darwin.airportDisconnected)).toEqual({ state: "disconnected" });
    expect(parseAirportNetwork(darwin.airportNotWifi)).toEqual({ state: "unknown" });
  });
  it("macOS ipconfig getsummary", () => {
    expect(parseIpconfigSummary(darwin.ipconfigSummaryConnected)).toEqual({ state: "connected", ssid: "HackerHouse HQ" });
    expect(parseIpconfigSummary(darwin.ipconfigSummaryDown)).toEqual({ state: "disconnected" });
    expect(parseIpconfigSummary("")).toEqual({ state: "unknown" });
  });
  it("Linux nmcli", () => {
    expect(parseNmcliWifi(linux.nmcliConnected)).toEqual({ state: "connected", ssid: "HackerHouse HQ" });
    expect(parseNmcliWifi(linux.nmcliDisconnected)).toEqual({ state: "disconnected" });
    expect(parseNmcliWifi("")).toEqual({ state: "unknown" });
  });
  it("Linux iw dev", () => {
    expect(parseIwDev(linux.iwConnected)).toEqual({ state: "connected", ssid: "HackerHouse HQ", iface: "wlp2s0" });
    expect(parseIwDev(linux.iwDisconnected)).toEqual({ state: "disconnected", iface: "wlp2s0" });
    expect(parseIwDev("")).toEqual({ state: "unknown" });
  });
});

describe("traceroute", () => {
  it("parses hops and skips private ones to find the provider edge (Linux)", () => {
    const hops = parseTraceroute(linux.traceroute);
    expect(hops).toHaveLength(4);
    expect(hops[0]).toEqual({ hop: 1, ip: "172.16.255.1", ms: 0.19 });
    expect(firstPublicHop(hops, "172.16.255.1")).toBe("242.6.124.5");
  });
  it("skips CGNAT hops (macOS)", () => {
    const hops = parseTraceroute(darwin.traceroute);
    expect(hops[3]).toEqual({ hop: 4, ip: undefined, ms: undefined });
    expect(firstPublicHop(hops, "192.168.1.1")).toBe("68.85.130.13");
  });
  it("returns null when nothing public answers", () => {
    expect(firstPublicHop(parseTraceroute(linux.tracerouteDark), "192.168.1.1")).toBeNull();
  });
  it("classifies private ranges", () => {
    for (const ip of ["10.0.0.1", "172.20.1.1", "192.168.0.1", "100.64.0.1", "169.254.1.1", "127.0.0.1"]) expect(isPrivateIp(ip)).toBe(true);
    for (const ip of ["1.1.1.1", "68.85.130.13", "172.32.0.1", "100.128.0.1"]) expect(isPrivateIp(ip)).toBe(false);
  });
});
