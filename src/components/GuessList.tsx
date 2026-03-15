export interface GuessEntry {
  text: string;
  artistMatch: boolean;
  gameMatch: boolean;
}

interface GuessListProps {
  guesses: GuessEntry[];
  maxGuesses: number;
  solved: boolean;
}

export default function GuessList({ guesses, maxGuesses, solved }: GuessListProps) {
  if (guesses.length === 0) return null;

  return (
    <div className="w-full max-w-md mx-auto space-y-1">
      {guesses.map((guess, i) => {
        const isCorrect = solved && i === guesses.length - 1;
        return (
          <div
            key={i}
            data-testid="guess-entry"
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md ${
              isCorrect ? "bg-green-500/15" : "bg-muted/30"
            }`}
          >
            <span className="text-muted-foreground text-xs font-mono w-4">
              {i + 1}.
            </span>
            <span className={isCorrect ? "text-green-500 font-medium" : "text-destructive"}>
              {guess.text}
            </span>
            <span className="flex items-center gap-1 ml-auto">
              {!isCorrect && guess.artistMatch && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded"
                  title="Same artist"
                >
                  Artist
                </span>
              )}
              {!isCorrect && guess.gameMatch && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded"
                  title="Same Guitar Hero game"
                >
                  Game
                </span>
              )}
            </span>
          </div>
        );
      })}
      {guesses.length < maxGuesses && !solved && (
        <div className="text-xs text-muted-foreground text-center">
          {maxGuesses - guesses.length} guesses remaining
        </div>
      )}
      {guesses.length > 0 && guesses.some((g) => g.artistMatch || g.gameMatch) && (
        <div className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Same artist
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400" /> Same GH game
          </span>
        </div>
      )}
    </div>
  );
}
