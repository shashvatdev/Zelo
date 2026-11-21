"use client";

import { useInView } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ask, RELEASE, SUGGESTIONS, type Answer } from "@/lib/askZelo";
import { sound } from "@/lib/sound";
import FlowChart, { flowDelays } from "./FlowChart";

const AUTO_QUESTION = "How much work is going into this release?";
const STEPS = [
  `Reading ${RELEASE}`,
  "Walking 4 features and 10 tickets",
  "Drawing the answer",
];

function wantsSound() {
  try {
    return localStorage.getItem("zelo-sound") !== "off";
  } catch {
    return true;
  }
}

/**
 * Type a question about the sample release in plain words and the answer is drawn as a
 * flowchart. Runs on sample data in the browser; no AI model is called.
 */
export default function AskZelo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -25% 0px" });
  const [text, setText] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "thinking" | "answer">("idle");
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [run, setRun] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Typing yourself, or clicking a chip, stops the auto demo.
  const stopAuto = () => {
    autoTimers.current.forEach(clearTimeout);
    autoTimers.current = [];
  };

  const later = (fn: () => void, ms: number) =>
    timers.current.push(setTimeout(fn, ms));

  const submit = useCallback((q: string, withGesture: boolean) => {
    const clean = q.trim();
    if (!clean) return;
    clearTimers();
    if (withGesture) stopAuto();
    // A typed or clicked question is a user gesture, so sound can start here.
    if (withGesture && sound && wantsSound())
      sound.enable({ ambient: false, voices: false });
    const result = ask(clean);
    setQuestion(clean);
    setText("");
    setPhase("thinking");
    setStep(0);
    later(() => setStep(1), 280);
    later(() => setStep(2), 560);
    later(() => {
      setAnswer(result);
      setPhase("answer");
      setRun((r) => r + 1);
      if (sound?.enabled) {
        sound.play(
          flowDelays(
            result.tree,
            window.matchMedia("(max-width: 700px)").matches,
          ).map((n) => ({
            t: n.t,
            kind: "tock" as const,
            pitch: n.depth === 0 ? 0.75 : n.depth === 1 ? 1 : 1.35,
            vol: n.depth === 2 ? 0.28 : 0.45,
          })),
        );
      }
    }, 860);
  }, []);

  // First time the demo scrolls into view, it types a question by itself and answers it.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!inView || autoStarted.current) return;
    autoStarted.current = true;
    const auto = (fn: () => void, ms: number) =>
      autoTimers.current.push(setTimeout(fn, ms));
    let i = 0;
    const type = () => {
      i += 1;
      setText(AUTO_QUESTION.slice(0, i));
      if (i < AUTO_QUESTION.length) auto(type, 38);
      else auto(() => submit(AUTO_QUESTION, false), 380);
    };
    auto(type, 500);
  }, [inView, submit]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      autoTimers.current.forEach(clearTimeout);
    },
    [],
  );

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(text, true);
  };

  return (
    <div className="ask" ref={ref}>
      <div className="ask-bar">
        <span className="ask-spark" aria-hidden="true">
          <svg width="14" height="14" viewBox="-10 -10 20 20">
            <path
              d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <strong>Ask Zelo</strong>
        <span className="ask-scope">{RELEASE} · sample data</span>
      </div>

      <div className="ask-body" aria-live="polite">
        {question && (
          <div className="ask-q">
            <span className="avatar" style={{ background: "var(--coral)" }}>
              B
            </span>
            <p>{question}</p>
          </div>
        )}

        {phase === "thinking" && (
          <ul className="ask-steps">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={i < step ? "done" : i === step ? "on" : ""}
              >
                {s}
              </li>
            ))}
          </ul>
        )}

        {phase === "answer" && answer && (
          <div className="ask-a" key={run}>
            <p className="ask-summary">{answer.summary}</p>
            <div className="ask-flow">
              <FlowChart tree={answer.tree} narrow={narrow} />
            </div>
          </div>
        )}

        {phase === "idle" && !question && (
          <p className="ask-empty">
            Ask how much work is in the release, how much is done, who did what,
            or what is stuck.
          </p>
        )}
      </div>

      <form className="ask-form" onSubmit={onSubmit}>
        <label htmlFor="ask-input" className="sr-only">
          Ask a question about the release
        </label>
        <input
          id="ask-input"
          value={text}
          onChange={(e) => {
            stopAuto();
            setText(e.target.value);
          }}
          placeholder="Ask anything about this release"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-ink" aria-label="Ask">
          Ask
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 12h13M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
      <div className="ask-chips">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="chip ask-chip"
            onClick={() => submit(s, true)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
