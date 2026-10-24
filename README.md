# Sentinel

Your network's advocate: detects outages, diagnoses them with an on-device model, fixes what it can,
and when it's the internet provider's fault, **calls their support line for you** with the evidence.

See `AGENTS.md` for how the code is organised. Built at the Devin Hackathon, Hackerhouse @ GT, 2026-10-24.

## Run it

```bash
pnpm install
pnpm sentinel
```

Sentinel runs on your Mac and opens in its own window. Nothing is hosted, so it keeps working with the
internet down. It needs [Ollama](https://ollama.com) running `llama3.2:3b` for the on-device explanations.
Add `FULLSCREEN=1` for a full-screen window.
