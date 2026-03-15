import { useParams, Link } from "react-router-dom";
import App from "./App.tsx";
import type { DailyChallenge, SongListEntry } from "./types.ts";
import { ChallengeContext } from "./context/ChallengeContext.tsx";

interface Props {
  archive: Record<string, DailyChallenge>;
  songList: SongListEntry[];
  latestChallengeNumber: number;
}

export default function ArchiveRoute({ archive, songList, latestChallengeNumber }: Props) {
  const { challengeNumber } = useParams<{ challengeNumber: string }>();
  const challenge = challengeNumber ? archive[challengeNumber] : undefined;

  if (!challenge) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-lg font-semibold">Challenge #{challengeNumber} not found</p>
        <p className="text-sm text-muted-foreground">
          <Link to="/" className="underline">Play today's challenge</Link>
        </p>
      </div>
    );
  }

  return (
    <ChallengeContext.Provider value={{ challenge, songList, latestChallengeNumber }}>
      <App key={challenge.challengeNumber} />
    </ChallengeContext.Provider>
  );
}
