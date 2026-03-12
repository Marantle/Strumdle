import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import type { DailyResult } from "../types";
import type { GuessEntry } from "./GuessList";

interface ResultModalProps {
  open: boolean;
  onClose: () => void;
  onReplay: () => void;
  title: string;
  artist: string;
  solved: boolean;
  result: DailyResult;
  guessEntries: GuessEntry[];
  challengeNumber: number;
  maxGuesses: number;
  nextChallengeAt?: string;
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
    if (isCorrect) return "\u{1F7E9}\u{1F7E9}";
    const artist = entry.artistMatch ? "\u{1F7E8}" : "\u2B1B";
    const game = entry.gameMatch ? "\u{1F7E6}" : "\u2B1B";
    return `${artist}${game}`;
  });
  return `Strumdle #${challengeNumber} ${score}\n\n${rows.join("\n")}\n\n\u{1F7E8} Artist  \u{1F7E6} Game`;
}

function useCountdown(targetIso?: string) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();

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
  title,
  artist,
  solved,
  result,
  guessEntries,
  challengeNumber,
  maxGuesses,
  nextChallengeAt,
}: ResultModalProps) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
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

  if (!open) return null;

  const handleShare = async () => {
    const text = generateShareText(result, guessEntries, challengeNumber, maxGuesses);
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const guessRows = Array.from({ length: maxGuesses }, (_, i) => {
    if (i >= result.guesses.length) return "empty";
    if (result.solved && i === result.guesses.length - 1) return "correct";
    return "wrong";
  });

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

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={onReplay}
          >
            Replay Clip
          </Button>
          <Button
            onClick={handleShare}
            className="w-full"
            size="lg"
          >
            {copied ? "Copied to clipboard!" : "Share Result"}
          </Button>

          {/* Countdown */}
          {countdown && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Next Strumdle in</p>
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
