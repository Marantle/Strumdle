import { useState, useEffect } from "react";
import { Button } from "./ui/button";
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
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">("idle");
  const [visible, setVisible] = useState(false);
  const [dailyStats, setDailyStats] = useState<DailyStatsResponse | null>(null);
  const countdown = useCountdown(nextChallengeAt);

  // Animate in
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadDailyStats() {
      try {
        const response = await fetch(`/api/stats?date=${encodeURIComponent(result.date)}`);
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

    if (typeof navigator.share === "function") {
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
        className={`relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transition-all duration-500 ${
          visible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4"
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
          <p className="text-lg font-bold leading-tight">{title}</p>
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
        {dailyStats && dailyStats.solves > 0 && (
          <div className="px-6 pb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
              Today&apos;s Solve Distribution
            </p>
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
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {dailyStats.solves}/{dailyStats.plays} solved today
            </p>
          </div>
        )}

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
              <p className="text-xs text-muted-foreground">Next Strumdle in (UTC)</p>
              <p className="text-2xl font-mono font-bold tracking-wider mt-0.5">
                {countdown}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
