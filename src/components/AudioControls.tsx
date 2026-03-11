import { useState, useEffect } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import { Button } from "./ui/button";
import {
  audioManager,
  SOUND_CATALOG,
  LANE_NAMES,
  type SoundId,
} from "../lib/audio/audioManager";
import type { Lane } from "../types";

interface AudioControlsProps {
  disabled?: boolean;
}

const LANE_COLORS_CSS = [
  "border-green-500",
  "border-red-500",
  "border-yellow-500",
  "border-blue-500",
  "border-orange-500",
];

const LANE_DOT_CSS = [
  "bg-green-500",
  "bg-red-500",
  "bg-yellow-500",
  "bg-blue-500",
  "bg-orange-500",
];

export default function AudioControls({ disabled = false }: AudioControlsProps) {
  const [muted, setMuted] = useState(audioManager.isMuted());
  const [laneSounds, setLaneSounds] = useState<SoundId[]>(audioManager.getLaneSounds());

  useEffect(() => {
    audioManager.initialize().catch(console.error);
  }, []);

  const handleMuteToggle = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    audioManager.setMuted(newMuted);
    if (!newMuted) audioManager.initialize().catch(console.error);
  };

  const handleLaneChange = (lane: number, sound: SoundId) => {
    audioManager.setLaneSound(lane as Lane, sound);
    setLaneSounds(audioManager.getLaneSounds());
    // Auto-preview on change
    audioManager.preview(lane as Lane, sound);
  };

  const handlePreview = (lane: number) => {
    audioManager.preview(lane as Lane, laneSounds[lane]);
  };

  const handleSetAll = (sound: SoundId) => {
    audioManager.setAllLanes(sound);
    setLaneSounds(audioManager.getLaneSounds());
    audioManager.preview(2 as Lane, sound); // Preview on middle lane
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {/* Mute toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleMuteToggle}
          disabled={disabled}
          className="gap-2"
        >
          {muted ? (
            <>
              <VolumeX className="h-4 w-4" />
              <span className="text-xs">Unmute</span>
            </>
          ) : (
            <>
              <Volume2 className="h-4 w-4" />
              <span className="text-xs">Mute</span>
            </>
          )}
        </Button>
      </div>

      {!muted && (
        <>
          {/* Quick set all lanes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Set all lanes
            </label>
            <select
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              value=""
              onChange={(e) => {
                if (e.target.value) handleSetAll(e.target.value as SoundId);
              }}
              disabled={disabled}
            >
              <option value="">Choose a sound...</option>
              {SOUND_CATALOG.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.description}
                </option>
              ))}
            </select>
          </div>

          {/* Per-lane selectors */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Per-lane sounds
            </label>
            {[0, 1, 2, 3, 4].map((lane) => (
              <div
                key={lane}
                className={`flex items-center gap-2 rounded-md border-l-4 ${LANE_COLORS_CSS[lane]} pl-2 py-1`}
              >
                <span className={`w-2 h-2 rounded-full ${LANE_DOT_CSS[lane]} shrink-0`} />
                <span className="text-xs font-medium w-12 shrink-0">
                  {LANE_NAMES[lane]}
                </span>
                <select
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                  value={laneSounds[lane]}
                  onChange={(e) => handleLaneChange(lane, e.target.value as SoundId)}
                  disabled={disabled}
                >
                  {SOUND_CATALOG.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePreview(lane)}
                  disabled={disabled}
                  className="h-7 w-7 p-0 shrink-0"
                  title={`Preview ${LANE_NAMES[lane]}`}
                >
                  <Play className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
