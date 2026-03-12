import { useState, useCallback, useEffect, useMemo } from "react";
import ChartHighway from "./components/ChartHighway";
import GuessInput from "./components/GuessInput";
import GuessList from "./components/GuessList";
import type { GuessEntry } from "./components/GuessList";
import ResultModal from "./components/ResultModal";
import WelcomeModal from "./components/WelcomeModal";
import AudioControls from "./components/AudioControls";
import { Button } from "./components/ui/button";
import { checkGuess, revealAnswer } from "./lib/guess/match";
import { audioManager } from "./lib/audio/audioManager";
import type { DailyChallenge, DailyResult, SongListEntry, GameState } from "./types";

// Import the generated daily challenge data
import dailyData from "./data/today.json";
import songListData from "./data/songList.json";

const challenge = dailyData as DailyChallenge;
const songList = songListData as SongListEntry[];

function loadResult(): DailyResult | null {
  try {
    const key = `daily-${challenge.date}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as DailyResult;
  } catch {
    return null;
  }
}

function saveResult(result: DailyResult) {
  const key = `daily-${challenge.date}`;
  localStorage.setItem(key, JSON.stringify(result));
}

// Re-derive GuessEntry[] from saved title strings
function hydrateGuesses(titles: string[]): GuessEntry[] {
  return titles.map((text) => {
    const result = checkGuess(text, challenge, songList);
    return { text, artistMatch: result.artistMatch, gameMatch: result.gameMatch };
  });
}

function getInitialState(saved: DailyResult | null): {
  gameState: GameState;
  guesses: GuessEntry[];
  solved: boolean;
  solvedOnAttempt: number | null;
} {
  if (saved) {
    const guesses = hydrateGuesses(saved.guesses);
    if (saved.solved) {
      return {
        gameState: "done",
        guesses,
        solved: true,
        solvedOnAttempt: saved.solvedOnAttempt,
      };
    }
    if (saved.guesses.length >= challenge.maxGuesses) {
      return {
        gameState: "done",
        guesses,
        solved: false,
        solvedOnAttempt: null,
      };
    }
    return {
      gameState: "idle",
      guesses,
      solved: false,
      solvedOnAttempt: null,
    };
  }
  return {
    gameState: "ready",
    guesses: [],
    solved: false,
    solvedOnAttempt: null,
  };
}

export default function App() {
  const saved = loadResult();
  const initial = getInitialState(saved);

  const [gameState, setGameState] = useState<GameState>(initial.gameState);
  const [guesses, setGuesses] = useState<GuessEntry[]>(initial.guesses);
  const [solved, setSolved] = useState(initial.solved);
  const [solvedOnAttempt, setSolvedOnAttempt] = useState<number | null>(
    initial.solvedOnAttempt,
  );
  const [modalOpen, setModalOpen] = useState(initial.gameState === "done");

  const isPlaying = gameState === "playing";
  const isDone = gameState === "done";
  const canGuess = gameState === "idle" || gameState === "ready";

  // Calculate visible clip duration based on number of guesses
  const BASE_DURATION_MS = 7_000;
  const EXTENSION_PER_GUESS_MS = 2_000;
  const visibleDurationMs = BASE_DURATION_MS + (guesses.length * EXTENSION_PER_GUESS_MS);

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
  }, [guessTitles, solved, solvedOnAttempt]);

  const handlePlay = useCallback(() => {
    audioManager.initialize().catch(console.error);
    setGameState("playing");
  }, []);

  const handlePlaybackComplete = useCallback(() => {
    setGameState("idle");
  }, []);

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
        setTimeout(() => setModalOpen(true), 600);
      } else if (newGuesses.length >= challenge.maxGuesses) {
        setGameState("done");
        setTimeout(() => setModalOpen(true), 600);
      }
    },
    [guesses],
  );

  const answer = isDone ? revealAnswer(challenge) : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-8 gap-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Strumdle</h1>
        <p className="text-sm text-muted-foreground">
          #{challenge.challengeNumber} &middot; Guess the song from the chart
        </p>
      </div>

      {/* Highway */}
      <ChartHighway
        notes={visibleNotes}
        clipDurationMs={visibleDurationMs}
        playing={isPlaying}
        onPlaybackComplete={handlePlaybackComplete}
        audioEnabled={true}
      />

      {/* Audio Controls */}
      <AudioControls disabled={isPlaying} />

      {/* Play / Replay button */}
      {!isPlaying && (
        <Button onClick={handlePlay} size="lg">
          {guesses.length === 0 ? "Play" : "Replay"}
        </Button>
      )}

      {/* Guess input */}
      <GuessInput
        onGuess={handleGuess}
        disabled={!canGuess || isPlaying}
        attemptsLeft={challenge.maxGuesses - guesses.length}
        songList={songList}
      />

      {/* Previous guesses */}
      <GuessList guesses={guesses} maxGuesses={challenge.maxGuesses} solved={solved} />

      {/* View Results button (when modal is closed but game is done) */}
      {isDone && answer && !modalOpen && (
        <Button variant="outline" onClick={() => setModalOpen(true)}>
          View Results
        </Button>
      )}

      {/* Welcome modal (first visit only) */}
      <WelcomeModal />

      {/* Result modal */}
      {isDone && answer && (
        <ResultModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onReplay={() => { setModalOpen(false); handlePlay(); }}
          title={answer.title}
          artist={answer.artist}
          solved={solved}
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
