import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { useChallengeContext } from "../context/ChallengeContext";
import type { DailyResult } from "../types";
import type { GuessEntry } from "./GuessList";

interface ResultModalProps {
  open: boolean;
  onClose: () => void;
  onReplay: () => void;
  replayDurationMs?: number;
  title: string;
  artist: string;
  solved: boolean;
  result: DailyResult;
  guessEntries: GuessEntry[];
  challengeNumber: number;
  maxGuesses: number;
  nextChallengeAt?: string;
}

interface DailyStatsResponse {
  date: string;
  plays: number;
  solves: number;
  attempts: Record<string, number>;
}

function createMockDailyStats(date: string, maxGuesses: number): DailyStatsResponse {
  const attempts: Record<string, number> = {};
  const mockCounts = [10, 8, 6, 3, 0, 0];

  for (let i = 0; i < maxGuesses; i++) {
    attempts[String(i + 1)] = mockCounts[i] ?? 1;
  }

  const solves = Object.values(attempts).reduce((sum, value) => sum + value, 0);
  return {
    date,
    attempts,
    solves,
    plays: solves + 4,
  };
}

function generateShareText(
  result: DailyResult,
  guessEntries: GuessEntry[],
  challengeNumber: number,
  maxGuesses: number,
): string {
  const score = result.solved
    ? `${result.solvedOnAttempt}/${maxGuesses}`
    : `X/${maxGuesses}`;
  const rows = guessEntries.map((entry, i) => {
    const isCorrect = result.solved && i === guessEntries.length - 1;
    if (isCorrect) return "\u{1F7E9}";
    if (entry.artistMatch) return "\u{1F7E8}";
    if (entry.gameMatch) return "\u{1F7E6}";
    return "\u2B1B";
  });
  const remaining = maxGuesses - guessEntries.length;
  const allRows = [...rows, ...Array(remaining).fill("\u2B1C")];
  return `https://strumdle.com #${challengeNumber} ${score} · ${result.date}\n\n${allRows.join("")}`;
}

function useCountdown(targetIso?: string) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const getNextUtcMidnight = () => {
      const now = new Date();
      return Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      );
    };

    const target = targetIso ? new Date(targetIso).getTime() : getNextUtcMidnight();

    function calc() {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft("00:00:00");
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setTimeLeft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return timeLeft;
}

function getChallengeDate(n: number, baseN: number, baseDate: string): string {
  const d = new Date(baseDate);
  d.setUTCDate(d.getUTCDate() + (n - baseN));
  return d.toISOString().split("T")[0];
}

const LEGEND_ITEMS = [
  { className: "challenge-ace ring-1 ring-yellow-400/60", label: "1st guess" },
  { className: "bg-emerald-500/25", label: "2nd guess" },
  { className: "bg-green-500/20", label: "3rd guess" },
  { className: "bg-teal-500/20", label: "4th guess" },
  { className: "bg-blue-500/20", label: "5th guess" },
  { className: "bg-orange-500/20", label: "6th guess" },
  { className: "bg-red-500/20", label: "Failed" },
  { className: "bg-muted", label: "Not played" },
];

function PastChallengesGrid({ current, total, baseDate, onClose }: { current: number; total: number; baseDate: string; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) gridRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open]);

  useEffect(() => {
    if (!legendOpen) return;
    function handleClick(e: MouseEvent) {
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) {
        setLegendOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [legendOpen]);

  return (
    <div ref={gridRef} className="border-t border-border/50 pt-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Past Challenges</span>
          <span>{open ? "▲" : "▼"}</span>
        </button>
        <div ref={legendRef} className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setLegendOpen((o) => !o); }}
            className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Color legend"
          >
            ?
          </button>
          {legendOpen && (
            <div className="absolute right-0 bottom-7 z-10 w-36 rounded-lg border border-border bg-card shadow-lg p-2.5 flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Legend</p>
              {LEGEND_ITEMS.map(({ className, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-sm shrink-0 ${className}`} />
                  <span className="text-[11px] text-foreground/80">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
            const isCurrent = n === current;
            const date = getChallengeDate(n, current, baseDate);
            const saved = (() => {
              try {
                const s = localStorage.getItem(`daily-${date}`);
                return s ? JSON.parse(s) as { solved: boolean; guesses: string[]; solvedOnAttempt?: number | null } : null;
              } catch { return null; }
            })();
            let status: "solved" | "failed" | "in-progress" | null = null;
            if (saved) {
              if (saved.solved) status = "solved";
              else if (saved.guesses.length >= 6) status = "failed";
              else if (saved.guesses.length > 0) status = "in-progress";
            }

            const baseClass = "w-9 h-9 flex items-center justify-center rounded-md text-xs font-bold transition-colors";
            if (isCurrent) {
              return (
                <span key={n} data-testid={`challenge-${n}`} data-status="current" className={`${baseClass} bg-primary text-primary-foreground`}>
                  #{n}
                </span>
              );
            }
            const solvedColorClass = (() => {
              switch (saved?.solvedOnAttempt) {
                case 1: return "challenge-ace text-yellow-200 ring-1 ring-yellow-400/60";
                case 2: return "bg-emerald-500/25 text-emerald-300 hover:bg-emerald-500/35";
                case 3: return "bg-green-500/20 text-green-400 hover:bg-green-500/30";
                case 4: return "bg-teal-500/20 text-teal-400 hover:bg-teal-500/30";
                case 5: return "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30";
                case 6: return "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30";
                default: return "bg-green-500/20 text-green-400 hover:bg-green-500/30";
              }
            })();
            const colorClass = status === "solved"
              ? solvedColorClass
              : status === "failed"
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground";
            return (
              <Link key={n} data-testid={`challenge-${n}`} data-status={status ?? "unplayed"} to={n === total ? "/" : `/${n}`} onClick={onClose} className={`${baseClass} font-medium ${colorClass}`}>
                #{n}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ResultModal({
  open,
  onClose,
  onReplay,
  replayDurationMs,
  title,
  artist,
  solved,
  result,
  guessEntries,
  challengeNumber,
  maxGuesses,
  nextChallengeAt,
}: ResultModalProps) {
  const { latestChallengeNumber } = useChallengeContext();
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">("idle");
  const [visible, setVisible] = useState(false);
  const [dailyStats, setDailyStats] = useState<DailyStatsResponse | null>(null);
  const [hasScrollBelow, setHasScrollBelow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const countdown = useCountdown(nextChallengeAt);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setHasScrollBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [open]);

  // Animate in
  useEffect(() => {
    let raf1: number, raf2: number;
    if (open) {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
    } else {
      raf1 = requestAnimationFrame(() => setVisible(false));
    }
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadDailyStats() {
      try {
        const response = await fetch(`/api/analytics?date=${encodeURIComponent(result.date)}`);
        if (!response.ok) {
          if (!cancelled) {
            setDailyStats(import.meta.env.DEV ? createMockDailyStats(result.date, maxGuesses) : null);
          }
          return;
        }

        const data = await response.json() as DailyStatsResponse;
        if (cancelled) return;
        setDailyStats(data);
      } catch {
        if (cancelled) return;
        setDailyStats(import.meta.env.DEV ? createMockDailyStats(result.date, maxGuesses) : null);
      }
    }

    loadDailyStats();
    return () => {
      cancelled = true;
    };
  }, [open, result.date, maxGuesses]);

  if (!open) return null;

  const handleShare = async () => {
    const text = generateShareText(result, guessEntries, challengeNumber, maxGuesses);
    const shareData = {
      title: `Strumdle #${challengeNumber}`,
      text,
      url: window.location.origin,
    };

    const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)
    if (isMobile && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        setShareState("shared");
        setTimeout(() => setShareState("idle"), 2500);
        return;
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setShareState("copied");
    setTimeout(() => setShareState("idle"), 2500);
  };

  const guessRows = Array.from({ length: maxGuesses }, (_, i) => {
    if (i >= result.guesses.length) return "empty";
    if (result.solved && i === result.guesses.length - 1) return "correct";
    return "wrong";
  });

  const attemptDistribution = Array.from({ length: maxGuesses }, (_, i) => {
    const attempt = i + 1;
    const count = dailyStats?.attempts?.[String(attempt)] ?? 0;
    return { attempt, count };
  });
  const maxAttemptCount = Math.max(1, ...attemptDistribution.map((row) => row.count));
  const replayButtonLabel = solved && replayDurationMs
    ? `Replay Full ${Math.round(replayDurationMs / 1000)}s Clip`
    : "Replay Clip";

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
      onClick={onClose}
    >
      <div
        ref={scrollRef}
        className={`relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh] transition-all duration-500 ${
          visible
            ? "opacity-100"
            : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
        >
          &times;
        </button>

        {/* Header banner */}
        <div
          className={`px-6 pt-8 pb-4 text-center ${
            solved
              ? "bg-gradient-to-b from-green-500/15 to-transparent"
              : "bg-gradient-to-b from-red-500/10 to-transparent"
          }`}
        >
          <div className="text-4xl mb-2">{solved ? "\u{1F3B8}" : "\u{1F614}"}</div>
          <h2 className="text-xl font-bold tracking-tight">
            {solved ? "Nice one!" : "Better luck next time"}
          </h2>
          {solved && (
            <p className="text-sm text-muted-foreground mt-1">
              You got it in {result.solvedOnAttempt}{" "}
              {result.solvedOnAttempt === 1 ? "guess" : "guesses"}!
            </p>
          )}
        </div>

        {/* Song info */}
        <div className="px-6 py-4 text-center border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
            {solved ? "You guessed" : "The answer was"}
          </p>
          <p className="text-lg font-bold leading-tight" data-testid="modal-song-title">{title}</p>
          <p className="text-sm text-muted-foreground">{artist}</p>
        </div>

        {/* Guess grid */}
        <div className="px-6 py-3 flex justify-center gap-1.5">
          {guessRows.map((status, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all ${
                status === "correct"
                  ? "bg-green-500 text-white"
                  : status === "wrong"
                    ? "bg-zinc-600 text-zinc-300"
                    : "bg-muted/40 border border-border/50"
              }`}
              style={{
                animationDelay: `${i * 80}ms`,
              }}
            >
              {status === "correct" ? "\u2713" : status === "wrong" ? (i + 1) : ""}
            </div>
          ))}
        </div>

        {/* Stats line */}
        <div className="px-6 pb-2 text-center">
          <p className="text-xs text-muted-foreground">
            Strumdle #{challengeNumber} &middot;{" "}
            {solved
              ? `${result.solvedOnAttempt}/${maxGuesses}`
              : `X/${maxGuesses}`}
          </p>
        </div>

        {/* Daily guess distribution */}
        <div className="px-6 pb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
            Today&apos;s Solve Distribution
          </p>
          {/* min-height reserves the full loaded height so the modal doesn't shift when stats arrive */}
          <div style={{ minHeight: `${maxGuesses * 26 + 28}px` }}>
          {dailyStats === null ? (
            <div className="space-y-1.5">
              {Array.from({ length: maxGuesses }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-4 h-3 rounded bg-muted/40 animate-pulse" />
                  <div className="flex-1 h-5 rounded-sm bg-muted/40 animate-pulse" />
                  <span className="w-5 h-3 rounded bg-muted/40 animate-pulse" />
                </div>
              ))}
              <p className="h-3 w-24 rounded bg-muted/40 animate-pulse mt-2" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {attemptDistribution.map((row) => {
                const widthPct = (row.count / maxAttemptCount) * 100;
                return (
                  <div key={row.attempt} className="flex items-center gap-2">
                    <span className="w-4 text-xs text-muted-foreground tabular-nums">
                      {row.attempt}
                    </span>
                    <div className="flex-1 h-5 rounded-sm bg-muted/40 border border-border/50 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500/80"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">
                      {row.count}
                    </span>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground mt-2">
                {dailyStats.solves}/{dailyStats.plays} solved today
              </p>
            </div>
          )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={onReplay}
          >
            {replayButtonLabel}
          </Button>
          <Button
            onClick={handleShare}
            className="w-full"
            size="lg"
          >
            {shareState === "shared"
              ? "Shared!"
              : shareState === "copied"
                ? "Copied to clipboard!"
                : "Share Result"}
          </Button>

          {/* Countdown */}
          {countdown && (
            <div className="text-center">
              {countdown === "00:00:00" ? (
                <>
                  <p className="text-2xl font-mono font-bold tracking-wider mt-0.5">Soon™</p>
                  <p className="text-xs text-muted-foreground mt-1">New Strumdle is on its way. Hang tight or try refreshing the page.</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Next Strumdle in (UTC)</p>
                  <p className="text-2xl font-mono font-bold tracking-wider mt-0.5">{countdown}</p>
                </>
              )}
            </div>
          )}

          {/* Past challenges grid */}
          {latestChallengeNumber > 1 && <PastChallengesGrid current={challengeNumber} total={latestChallengeNumber} baseDate={result.date} onClose={onClose} />}
        </div>

        {/* Scroll hint */}
        {hasScrollBelow && (
          <div className="sticky bottom-0 flex justify-center py-2 bg-gradient-to-t from-card to-transparent pointer-events-none">
            <span className="animate-bounce text-lg text-muted-foreground">↓</span>
          </div>
        )}
      </div>
    </div>
  );
}
