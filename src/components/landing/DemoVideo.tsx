"use client";

import { useReducedMotion } from "framer-motion";
import { Maximize2, Play, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Eyebrow, Section } from "./ui";

const SRC = "/demo/uplink-demo.mp4";
const POSTER = "/demo/uplink-demo-poster.jpg";

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * The product film. It loops silently while it's on screen; one click restarts it from the top,
 * full screen and with sound. Leaving full screen drops it back to the silent loop.
 */
export function DemoVideo() {
  const ref = useRef<FullscreenVideo>(null);
  const reduced = useReducedMotion();
  const [watching, setWatching] = useState(false);

  // silent loop only while visible, so it never burns battery off screen
  useEffect(() => {
    const video = ref.current;
    if (!video || reduced || watching) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [reduced, watching]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const backToLoop = () => {
      if (document.fullscreenElement) return;
      video.muted = true;
      video.controls = false;
      video.loop = true;
      setWatching(false);
    };
    const leave = () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else backToLoop();
    };
    document.addEventListener("fullscreenchange", backToLoop);
    video.addEventListener("webkitendfullscreen", backToLoop); // iPhone's own player
    video.addEventListener("ended", leave);
    return () => {
      document.removeEventListener("fullscreenchange", backToLoop);
      video.removeEventListener("webkitendfullscreen", backToLoop);
      video.removeEventListener("ended", leave);
    };
  }, []);

  const watch = async () => {
    const video = ref.current;
    if (!video) return;
    setWatching(true);
    video.currentTime = 0;
    video.muted = false;
    video.loop = false;
    video.controls = true;
    try {
      if (video.requestFullscreen) await video.requestFullscreen();
      else video.webkitEnterFullscreen?.();
    } catch {
      // full screen refused: it still plays here, with sound and controls
    }
    video.play().catch(() => {});
  };

  return (
    <Section id="demo" className="pb-10 pt-6 sm:pb-16">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
        <div>
          <Eyebrow dot>Watch the demo</Eyebrow>
          <h2 className="mt-5 text-[clamp(32px,3.6vw,44px)] font-semibold leading-[1.1] tracking-[-0.035em] text-neutral-950">
            See Uplink handle
            <br />
            <span className="text-neutral-400">a real outage.</span>
          </h2>
        </div>
        <p className="max-w-[420px] text-[16.5px] leading-[1.65] text-neutral-500 lg:justify-self-end">Thirty seconds, start to finish. Click to watch it full screen, with sound.</p>
      </div>

      <div className="group relative mt-10 overflow-hidden rounded-[22px] bg-[#0e0f12] shadow-[0_40px_100px_-40px_rgb(0_0_0/0.55)] ring-1 ring-black/10 sm:rounded-[28px]">
        <video
          ref={ref}
          className="block aspect-video w-full bg-[#0e0f12] object-cover"
          poster={POSTER}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Uplink product demo"
        >
          <source src={SRC} type="video/mp4" />
        </video>

        {!watching && (
          <button
            type="button"
            onClick={watch}
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 transition-colors duration-300 hover:bg-black/20 focus-visible:bg-black/20 focus-visible:outline-none"
            aria-label="Watch the demo full screen, with sound"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-neutral-950 shadow-[0_20px_50px_-10px_rgb(0_0_0/0.6)] backdrop-blur transition duration-300 group-hover:scale-110 sm:h-20 sm:w-20 sm:opacity-0 sm:group-hover:opacity-100">
              <Play className="h-6 w-6 translate-x-0.5 fill-current sm:h-7 sm:w-7" />
            </span>
            <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[12.5px] font-medium text-white backdrop-blur sm:bottom-5 sm:left-5 sm:text-[13.5px]">
              <VolumeX className="h-3.5 w-3.5" /> Watch with sound · 0:30
            </span>
            <span className="absolute bottom-3 right-3 hidden items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[13px] text-white/90 backdrop-blur sm:bottom-5 sm:right-5 sm:flex">
              <Maximize2 className="h-3.5 w-3.5" /> Full screen
            </span>
          </button>
        )}
      </div>
    </Section>
  );
}
