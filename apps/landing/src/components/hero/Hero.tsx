"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { sound, type SoundCue } from "@/lib/sound";
import Gate from "./Gate";
import HeroCanvas from "./HeroCanvas";
import {
  INTRO_END,
  INTRO_LINES,
  buildCues,
  buildLayout,
  type Layout,
} from "./tree";

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {on ? (
        <>
          <path
            d="M15.5 9a4.2 4.2 0 0 1 0 6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M18 6.5a7.8 7.8 0 0 1 0 11"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d="M16 9.5l5 5M21 9.5l-5 5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

const PREF_KEY = "zelo-sound";

/** Sound is on by default; only an explicit mute is remembered. */
function wantsSound() {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

function saveSoundPref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the choice just won't be remembered.
  }
}

type SoundMode = "off" | "on";

/**
 * gate:     the entry screen; its click or swipe is the gesture that unlocks audio.
 * intro:    the canvas plays full screen with captions and voiceover.
 * settling: the canvas window glides down into its place in the hero.
 * done:     normal page.
 */
type Phase = "gate" | "intro" | "settling" | "done";

/** Shifts cues so audio that starts late (after decoding) still lines up with the animation. */
function cuesFrom(cues: SoundCue[], elapsed: number): SoundCue[] {
  return cues.flatMap((c): SoundCue[] => {
    if (c.kind === "music") {
      const duration = c.duration - elapsed;
      return duration > 1 ? [{ ...c, t: 0, duration }] : [];
    }
    return c.t >= elapsed - 0.05
      ? [{ ...c, t: Math.max(0, c.t - elapsed) }]
      : [];
  });
}

export default function Hero() {
  const [compact, setCompact] = useState<boolean | null>(null);
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>("gate");
  const [gateLeaving, setGateLeaving] = useState(false);
  const [gateGone, setGateGone] = useState(false);
  const [mode, setMode] = useState<SoundMode>("off");
  const soundOn = mode === "on";

  const phaseRef = useRef<Phase>("gate");
  const introRun = useRef(true);
  const runStart = useRef(0);
  const windowRef = useRef<HTMLDivElement>(null);
  const fromRect = useRef<DOMRect | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    // The pre-paint script in layout.tsx adds "cine" for direct visits. Search visitors and
    // reduced-motion users get the normal page; the film stays one click away.
    const cinematic = document.documentElement.classList.contains("cine");
    if (cinematic) sound?.preload();
    const finish = () => {
      setGateGone(true);
      setPhase("done");
    };
    if (!cinematic) finish();
    else {
      window.scrollTo(0, 0);
      // Browsers that already allow audio skip the entry screen.
      if (sound?.canAutoplay() && wantsSound()) {
        sound.enable().then(() => {
          setMode("on");
          setGateGone(true);
          introRun.current = true;
          setPhase("intro");
          setRun((r) => r + 1);
        });
      }
    }
    return () => mq.removeEventListener("change", update);
  }, []);

  // Lock scrolling while the intro covers the page.
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("intro-lock", phase !== "done");
    return () => el.classList.remove("intro-lock");
  }, [phase]);

  const layout = useMemo(
    () => (compact === null ? null : buildLayout(compact)),
    [compact],
  );

  const playRun = useCallback((l: Layout) => {
    if (!sound?.enabled) return;
    const elapsed = (performance.now() - runStart.current) / 1000;
    sound.play(cuesFrom(buildCues(l, introRun.current), elapsed), {
      session: true,
    });
  }, []);

  // Each (re)run of the animation plays its sound, if sound is on.
  const gated = phase === "gate";
  useEffect(() => {
    if (!layout || gated) return;
    runStart.current = performance.now();
    playRun(layout);
  }, [layout, run, gated, playRun]);

  // The entry screen's gesture: turn sound on (if chosen), then start the film from 0s.
  const enter = useCallback(async (withSound: boolean) => {
    setGateLeaving(true);
    if (withSound && sound) {
      saveSoundPref(true);
      await sound.enable();
      setMode("on");
    }
    introRun.current = true;
    setPhase("intro");
    setRun((r) => r + 1);
    setTimeout(() => setGateGone(true), 700);
  }, []);

  const settle = useCallback(() => {
    if (phaseRef.current !== "intro") return;
    fromRect.current = windowRef.current?.getBoundingClientRect() ?? null;
    setPhase("settling");
  }, []);

  // End the intro when its timeline is over.
  useEffect(() => {
    if (phase !== "intro" || !layout) return;
    const timer = setTimeout(settle, INTRO_END * 1000);
    return () => clearTimeout(timer);
  }, [phase, layout, run, settle]);

  // Glide the window from its full-screen box down to its place in the page (FLIP).
  useLayoutEffect(() => {
    if (phase !== "settling") return;
    const el = windowRef.current;
    const from = fromRect.current;
    const done = () => setPhase("done");
    if (!el || !from) {
      done();
      return;
    }
    const to = el.getBoundingClientRect();
    const scale = from.width / to.width;
    const anim = el.animate(
      [
        {
          transformOrigin: "top left",
          transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`,
        },
        { transformOrigin: "top left", transform: "none" },
      ],
      { duration: 950, easing: "cubic-bezier(0.7, 0, 0.2, 1)" },
    );
    anim.onfinish = done;
    return () => anim.cancel();
  }, [phase]);

  const playIntro = useCallback(() => {
    window.scrollTo(0, 0);
    introRun.current = true;
    setPhase("intro");
    setRun((r) => r + 1);
  }, []);

  const replayInline = useCallback(() => {
    introRun.current = false;
    setRun((r) => r + 1);
  }, []);

  const skip = useCallback(() => {
    sound?.stopSession();
    settle();
  }, [settle]);

  const toggleSound = useCallback(async () => {
    if (!sound) return;
    if (mode === "on") {
      sound.disable();
      saveSoundPref(false);
      setMode("off");
      return;
    }
    saveSoundPref(true);
    await sound.enable();
    setMode("on");
    playIntro();
  }, [mode, playIntro]);

  const soundLabel = mode === "on" ? "Sound on" : "Play with sound";
  const ar = compact ? 480 / 554 : 1200 / 590;
  const intro = phase === "intro";

  return (
    <section className="hero" id="top" data-phase={phase}>
      {!gateGone && <Gate leaving={gateLeaving} onEnter={enter} />}
      {phase !== "done" && (
        <>
          <div
            className={
              phase === "settling" ? "intro-backdrop out" : "intro-backdrop"
            }
            aria-hidden="true"
          />
          {phase !== "gate" && (
            <div
              className={phase === "settling" ? "intro-caps out" : "intro-caps"}
              key={`caps-${run}`}
              aria-live="polite"
            >
              {INTRO_LINES.map((line, i) => {
                const next = INTRO_LINES[i + 1]?.t ?? 999;
                return (
                  <p
                    key={line.text}
                    className="intro-cap display"
                    style={
                      {
                        "--in": `${line.t}s`,
                        "--out": `${next}s`,
                      } as CSSProperties
                    }
                  >
                    {line.text}
                  </p>
                );
              })}
            </div>
          )}
          {intro && (
            <div className="intro-ui">
              <button type="button" className="intro-skip" onClick={skip}>
                Skip intro
              </button>
            </div>
          )}
        </>
      )}

      <div className="hero-copy">
        <p className="eyebrow hand">for teams that ship software</p>
        <h1 className="display">
          Work isn&apos;t a{" "}
          <span className="strike">
            list
            <svg
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M2 12 C 30 6, 60 15, 98 7" pathLength={1} />
            </svg>
          </span>
          . <br />
          It&apos;s a <em>map</em>.
        </h1>
        <p className="lede">
          Zelo connects every ticket to its feature, every feature to its
          release, and every doc to the work it describes. One living canvas,
          from day zero to today.
        </p>
        <div className="hero-ctas">
          <a href="#waitlist" className="btn btn-ink">
            Join the waitlist
          </a>
          <button
            type="button"
            className={"btn btn-ghost"}
            onClick={toggleSound}
            aria-pressed={soundOn}
            data-sound-toggle
          >
            <SpeakerIcon on={mode !== "off"} />
            {soundLabel}
          </button>
        </div>
      </div>

      <div
        className={intro ? "window-slot holding" : "window-slot"}
        style={{ "--ar": ar } as CSSProperties}
      >
        <div
          ref={windowRef}
          className={intro ? "window window-intro" : "window"}
        >
          <div className="window-bar">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="crumbs">
              Acme <b>/</b> Releases <b>/</b> <strong>v2.3</strong>
            </span>
            <span className="views" aria-hidden="true">
              <span className="on">Canvas</span>
              <span>List</span>
              <span>Timeline</span>
            </span>
            <button
              type="button"
              className="replay"
              onClick={replayInline}
              aria-label="Replay the animation"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Replay
            </button>
          </div>
          <div className="canvas">
            {layout && phase !== "gate" && (
              <HeroCanvas key={`${run}-${compact}`} layout={layout} />
            )}
          </div>
        </div>
      </div>
      <p className="hero-note">
        Visual project management for PMs, developers, QA and the business team,
        on the same canvas.
      </p>
    </section>
  );
}
