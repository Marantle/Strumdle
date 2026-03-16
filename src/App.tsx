import { useState, useCallback, useEffect, useMemo } from "react";
import ChartHighway from "./components/ChartHighway";
import GuessInput from "./components/GuessInput";
import GuessList from "./components/GuessList";
import type { GuessEntry } from "./components/GuessList";
import ResultModal from "./components/ResultModal";
import WelcomeModal from "./components/WelcomeModal";
import WhatsNewModal from "./components/WhatsNewModal";
import AudioControls from "./components/AudioControls";
import { Button } from "./components/ui/button";
import { checkGuess, revealAnswer } from "./lib/guess/match";
import { audioManager } from "./lib/audio/audioManager";
import { useChallengeContext } from "./context/ChallengeContext";
import type { DailyChallenge, DailyResult, SongListEntry, GameState } from "./types";


interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function loadResult(date: string): DailyResult | null {
  try {
    const stored = localStorage.getItem(`daily-${date}`);
    if (!stored) return null;
    return JSON.parse(stored) as DailyResult;
  } catch {
    return null;
  }
}

function saveResult(result: DailyResult) {
  localStorage.setItem(`daily-${result.date}`, JSON.stringify(result));
}

function reportStats(date: string, solved: boolean, attempts: number) {
  const key = `stats-reported-${date}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "1");
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, solved, attempts }),
  }).catch(() => {}); // fire-and-forget
}

function hydrateGuesses(
  titles: string[],
  challenge: DailyChallenge,
  songList: SongListEntry[],
): GuessEntry[] {
  return titles.map((text) => {
    const result = checkGuess(text, challenge, songList);
    return { text, artistMatch: result.artistMatch, gameMatch: result.gameMatch };
  });
}

function getInitialState(
  saved: DailyResult | null,
  challenge: DailyChallenge,
  songList: SongListEntry[],
): {
  gameState: GameState;
  guesses: GuessEntry[];
  solved: boolean;
  solvedOnAttempt: number | null;
} {
  if (saved) {
    const guesses = hydrateGuesses(saved.guesses, challenge, songList);
    if (saved.solved) {
      return { gameState: "done", guesses, solved: true, solvedOnAttempt: saved.solvedOnAttempt };
    }
    if (saved.guesses.length >= challenge.maxGuesses) {
      return { gameState: "done", guesses, solved: false, solvedOnAttempt: null };
    }
    return { gameState: "idle", guesses, solved: false, solvedOnAttempt: null };
  }
  return { gameState: "ready", guesses: [], solved: false, solvedOnAttempt: null };
}

export default function App() {
  const { challenge, songList } = useChallengeContext();
  const saved = loadResult(challenge.date);
  const initial = getInitialState(saved, challenge, songList);

  const [gameState, setGameState] = useState<GameState>(initial.gameState);
  const [guesses, setGuesses] = useState<GuessEntry[]>(initial.guesses);
  const [solved, setSolved] = useState(initial.solved);
  const [solvedOnAttempt, setSolvedOnAttempt] = useState<number | null>(
    initial.solvedOnAttempt,
  );
  const [modalOpen, setModalOpen] = useState(initial.gameState === "done");
  const [showExtension, setShowExtension] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
  );

  const isPlaying = gameState === "playing";
  const isFinished = solved || guesses.length >= challenge.maxGuesses;
  const canGuess = gameState === "idle" || gameState === "ready";

  // Calculate visible clip duration based on number of guesses
  const BASE_DURATION_MS = 7_000;
  const EXTENSION_PER_GUESS_MS = 2_000;
  const FULL_REPLAY_DURATION_MS =
    BASE_DURATION_MS + (challenge.maxGuesses * EXTENSION_PER_GUESS_MS);
  const visibleDurationMs = solved
    ? FULL_REPLAY_DURATION_MS
    : BASE_DURATION_MS + (guesses.length * EXTENSION_PER_GUESS_MS);

  // Filter notes to only show those within the visible duration
  const visibleNotes = challenge.clip.notes.filter(note => note.timeMs < visibleDurationMs);

  // Plain title strings for localStorage persistence
  const guessTitles = useMemo(() => guesses.map((g) => g.text), [guesses]);

  // Persist state on changes
  useEffect(() => {
    const result: DailyResult = {
      date: challenge.date,
      guesses: guessTitles,
      solved,
      solvedOnAttempt,
    };
    saveResult(result);
  }, [challenge.date, guessTitles, solved, solvedOnAttempt]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  }, [installPromptEvent]);

  const handlePlay = useCallback(() => {
    audioManager.initialize().catch(console.error);
    setGameState("playing");
  }, []);

  const handleStop = useCallback(() => {
    setGameState("idle");
  }, []);

  const handlePlaybackComplete = useCallback(() => {
    setGameState("idle");
  }, []);

  const handleSkip = useCallback(() => {
    const newGuesses = [...guesses, { text: "—", artistMatch: false, gameMatch: false }];
    setGuesses(newGuesses);
    if (newGuesses.length >= challenge.maxGuesses) {
      setGameState("done");
      reportStats(challenge.date, false, newGuesses.length);
      setTimeout(() => setModalOpen(true), 600);
    } else {
      setShowExtension(true);
      setTimeout(() => setShowExtension(false), 1500);
    }
  }, [guesses, challenge.maxGuesses, challenge.date]);

  const handleGuess = useCallback(
    (guess: string) => {
      const result = checkGuess(guess, challenge, songList);
      const entry: GuessEntry = {
        text: guess,
        artistMatch: result.artistMatch,
        gameMatch: result.gameMatch,
      };
      const newGuesses = [...guesses, entry];
      setGuesses(newGuesses);

      if (result.correct) {
        setSolved(true);
        setSolvedOnAttempt(newGuesses.length);
        setGameState("done");
        reportStats(challenge.date, true, newGuesses.length);
        setTimeout(() => setModalOpen(true), 600);
      } else if (newGuesses.length >= challenge.maxGuesses) {
        setGameState("done");
        reportStats(challenge.date, false, newGuesses.length);
        setTimeout(() => setModalOpen(true), 600);
      } else {
        setShowExtension(true);
        setTimeout(() => setShowExtension(false), 2000);
      }
    },
    [guesses, challenge, songList],
  );

  const answer = isFinished ? revealAnswer(challenge) : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-8 gap-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Strumdle</h1>
        <p className="text-sm text-muted-foreground">
          #{challenge.challengeNumber} &nbsp; Guess the song from the chart
        </p>
        {challenge.challengeNumber === 1 && (
          <p className="text-xs text-muted-foreground/60 mt-1">
            This is a dev/test song — the real challenges start at #2
          </p>
        )}
        {!isInstalled && installPromptEvent && (
          <Button className="mt-3" variant="outline" size="sm" onClick={handleInstall}>
            Install App
          </Button>
        )}
      </div>

      {/* Highway */}
      <ChartHighway
        notes={visibleNotes}
        clipDurationMs={visibleDurationMs}
        songStartMs={challenge.clipSongStartMs ?? 0}
        playing={isPlaying}
        onPlaybackComplete={handlePlaybackComplete}
        audioEnabled={true}
      />

      {/* Audio Controls */}
      <AudioControls disabled={isPlaying} />

      {/* Play / Stop / Replay button */}
      {isPlaying ? (
        <Button variant="outline" onClick={handleStop} size="lg">
          Stop
        </Button>
      ) : (
        <div className="relative">
          <Button onClick={handlePlay} size="lg">
            {guesses.length === 0 ? "Play" : "Replay"}
          </Button>
          {showExtension && (
            <span className="absolute -right-14 top-1/2 -translate-y-1/2 text-sm font-medium text-emerald-400 animate-pulse">
              +2s
            </span>
          )}
        </div>
      )}

      {/* Guess input */}
      <GuessInput
        onGuess={handleGuess}
        onSkip={handleSkip}
        disabled={!canGuess || isPlaying}
        attemptsLeft={challenge.maxGuesses - guesses.length}
      />

      {/* Previous guesses */}
      <GuessList guesses={guesses} maxGuesses={challenge.maxGuesses} solved={solved} />

      {/* View Results button (when modal is closed but game is finished) */}
      {isFinished && answer && !modalOpen && (
        <Button variant="outline" onClick={() => { handleStop(); setModalOpen(true); }}>
          View Results
        </Button>
      )}

      {/* Welcome modal (first visit only) */}
      <WelcomeModal />

      {/* What's new modal (returning users, once per version) */}
      <WhatsNewModal />

      {/* Result modal */}
      {isFinished && answer && (
        <ResultModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onReplay={() => { setModalOpen(false); handlePlay(); }}
          title={answer.title}
          artist={answer.artist}
          solved={solved}
          replayDurationMs={FULL_REPLAY_DURATION_MS}
          result={{
            date: challenge.date,
            guesses: guessTitles,
            solved,
            solvedOnAttempt,
          }}
          guessEntries={guesses}
          challengeNumber={challenge.challengeNumber}
          maxGuesses={challenge.maxGuesses}
          nextChallengeAt={challenge.nextChallengeAt}
        />
      )}
    </div>
  );
}
