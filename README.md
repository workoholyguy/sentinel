# Sentinel

Your network's advocate: detects outages, diagnoses them with an on-device model, fixes what it can,
and when it's the internet provider's fault, **calls their support line for you** with the evidence.

See `AGENTS.md` for how the code is organised. Built at the Devin Hackathon, Hackerhouse @ GT, 2026-10-24.

## Run it

```bash
pnpm install
pnpm sentinel
```

Sentinel runs on your Mac and opens the live dashboard (`/dashboard`) in its own window. Nothing is hosted, so it keeps working with the
internet down. It needs [Ollama](https://ollama.com) running `llama3.2:3b` for the on-device explanations.
Add `FULLSCREEN=1` for a full-screen window.

## Website

The public face of the product is **Uplink**. `pnpm dev` serves the marketing site at `/` and the live dashboard at
`/dashboard`. The site lives in `src/components/landing/`: a dotted-map hero where outages appear and get resolved,
then five steps (monitor, diagnose, resolve, call the ISP, Devin writes the fix), the downtime cost calculator and a
footer with the world map. The dot grids are built on the server with `dotted-map` (`src/components/ui/dotted-map.ts`),
so the browser only gets the finished map.
