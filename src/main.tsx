import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import ArchiveRoute from "./ArchiveRoute.tsx";
import type { DailyChallenge, SongListEntry } from "./types.ts";
import dailyData from "./data/today.json";
import songListData from "./data/songList.json";
import archiveData from "./data/archive.json";

const todayChallenge = dailyData as DailyChallenge;
const songList = songListData as SongListEntry[];
const archive = archiveData as Record<string, DailyChallenge>;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App challenge={todayChallenge} songList={songList} />} />
        <Route path="/:challengeNumber" element={<ArchiveRoute archive={archive} songList={songList} />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
