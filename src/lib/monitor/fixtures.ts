// Command output fixtures. Linux samples were captured on an Ubuntu VM (iputils ping,
// iproute2, traceroute 2.1); macOS samples follow the stock macOS 14 tool output.

export const linux = {
  pingOk: `PING 1.1.1.1 (1.1.1.1) 56(84) bytes of data.
64 bytes from 1.1.1.1: icmp_seq=1 ttl=54 time=7.44 ms
64 bytes from 1.1.1.1: icmp_seq=2 ttl=54 time=6.97 ms
64 bytes from 1.1.1.1: icmp_seq=3 ttl=54 time=6.79 ms

--- 1.1.1.1 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2011ms
rtt min/avg/max/mdev = 6.792/7.067/7.443/0.275 ms
`,
  pingPartial: `PING 192.168.1.1 (192.168.1.1) 56(84) bytes of data.
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=181 ms
64 bytes from 192.168.1.1: icmp_seq=3 ttl=64 time=203 ms
From 192.168.1.20 icmp_seq=2 Destination Host Unreachable

--- 192.168.1.1 ping statistics ---
3 packets transmitted, 2 received, +1 errors, 33.3333% packet loss, time 405ms
rtt min/avg/max/mdev = 181.022/192.114/203.207/11.092 ms
`,
  pingDead: `PING 172.16.255.1 (172.16.255.1) 56(84) bytes of data.

--- 172.16.255.1 ping statistics ---
3 packets transmitted, 0 received, 100% packet loss, time 2042ms

`,
  routeDefault: `default via 172.16.255.1 dev ens5 proto static 
`,
  routeDefaultDhcp: `default via 192.168.1.1 dev wlp2s0 proto dhcp src 192.168.1.20 metric 600 
`,
  routeNone: ``,
  traceroute: `traceroute to 1.1.1.1 (1.1.1.1), 4 hops max, 60 byte packets
 1  172.16.255.1  0.190 ms
 2  172.16.3.1  0.153 ms
 3  10.20.128.67  0.685 ms
 4  242.6.124.5  7.615 ms
`,
  tracerouteDark: `traceroute to 1.1.1.1 (1.1.1.1), 4 hops max, 60 byte packets
 1  192.168.1.1  2.311 ms
 2  *
 3  *
 4  *
`,
  nmcliConnected: `no:Neighbor 5G
yes:HackerHouse HQ
no:xfinitywifi
`,
  nmcliDisconnected: `no:Neighbor 5G
no:HackerHouse HQ
`,
  iwConnected: `phy#0
	Interface wlp2s0
		ifindex 3
		wdev 0x1
		addr 3c:58:c2:aa:bb:cc
		ssid HackerHouse HQ
		type managed
		channel 36 (5180 MHz), width: 80 MHz, center1: 5210 MHz
		txpower 22.00 dBm
`,
  iwDisconnected: `phy#0
	Interface wlp2s0
		ifindex 3
		wdev 0x1
		addr 3c:58:c2:aa:bb:cc
		type managed
		txpower 22.00 dBm
`,
};

export const darwin = {
  pingOk: `PING 192.168.1.1 (192.168.1.1): 56 data bytes
64 bytes from 192.168.1.1: icmp_seq=0 ttl=64 time=2.871 ms
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=3.322 ms
64 bytes from 192.168.1.1: icmp_seq=2 ttl=64 time=4.012 ms

--- 192.168.1.1 ping statistics ---
3 packets transmitted, 3 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 2.871/3.402/4.012/0.471 ms
`,
  pingPartial: `PING 68.85.130.13 (68.85.130.13): 56 data bytes
64 bytes from 68.85.130.13: icmp_seq=0 ttl=253 time=398.204 ms
Request timeout for icmp_seq 1
64 bytes from 68.85.130.13: icmp_seq=2 ttl=253 time=425.911 ms

--- 68.85.130.13 ping statistics ---
3 packets transmitted, 2 packets received, 33.3% packet loss
round-trip min/avg/max/stddev = 398.204/412.058/425.911/13.854 ms
`,
  pingDead: `PING 192.168.1.1 (192.168.1.1): 56 data bytes
Request timeout for icmp_seq 0
Request timeout for icmp_seq 1

--- 192.168.1.1 ping statistics ---
3 packets transmitted, 0 packets received, 100.0% packet loss
`,
  routeDefault: `   route to: default
destination: default
       mask: default
    gateway: 192.168.1.1
  interface: en0
      flags: <UP,GATEWAY,DONE,STATIC,PRCLONING,GLOBAL>
 recvpipe  sendpipe  ssthresh  rtt,msec    rttvar  hopcount      mtu     expire
       0         0         0         0         0         0      1500         0
`,
  routeNone: `route: writing to routing socket: not in table
`,
  airportConnected: `Current Wi-Fi Network: HackerHouse HQ
`,
  airportDisconnected: `You are not associated with an AirPort network.
`,
  airportNotWifi: `en0 is not a Wi-Fi interface.
** Error: Error obtaining wireless information.
`,
  ipconfigSummaryConnected: `<dictionary> {
  BSSID : <redacted>
  IPv4 : <array> {
    0 : <dictionary> {
      Addresses : <array> {
        0 : 192.168.1.23
      }
    }
  }
  InterfaceType : WiFi
  LinkStatusActive : TRUE
  NetworkID : 4F2C1D5E-3E2B-4E6F-9A0B-6C1D2E3F4A5B
  SSID : HackerHouse HQ
  Security : WPA2_PSK
}
`,
  ipconfigSummaryDown: `<dictionary> {
  InterfaceType : WiFi
  LinkStatusActive : FALSE
}
`,
  traceroute: ` 1  192.168.1.1  3.112 ms
 2  100.92.0.1  9.871 ms
 3  68.85.130.13  10.552 ms
 4  *
`,
};
