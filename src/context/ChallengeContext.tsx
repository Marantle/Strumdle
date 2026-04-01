import { createContext, use } from "react";
import type { DailyChallenge, SongListEntry } from "../types";

interface ChallengeContextType {
  challenge: DailyChallenge;
  songList: SongListEntry[];
  latestChallengeNumber: number;
}

export const ChallengeContext = createContext<ChallengeContextType | null>(null);

export function useChallengeContext(): ChallengeContextType {
  const ctx = use(ChallengeContext);
  if (!ctx) throw new Error("useChallengeContext must be used within ChallengeContext.Provider");
  return ctx;
}
