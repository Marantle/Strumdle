import { useState, useRef, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import type { SongListEntry } from "../types";

interface GuessInputProps {
  onGuess: (guess: string) => void;
  disabled: boolean;
  attemptsLeft: number;
  songList: SongListEntry[];
}

export default function GuessInput({
  onGuess,
  disabled,
  attemptsLeft,
  songList,
}: GuessInputProps) {
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(
    () => new Fuse(songList, { keys: ["title", "artist"], threshold: 0.4, distance: 100 }),
    [songList],
  );

  const suggestions = useMemo(() => {
    if (value.trim().length < 1) return [];
    return fuse.search(value, { limit: 6 }).map((r) => r.item);
  }, [fuse, value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const submit = (title: string) => {
    if (!title) return;
    onGuess(title);
    setValue("");
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only allow submitting a selected suggestion
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      submit(suggestions[selectedIndex].title);
    } else if (suggestions.length === 1) {
      // Auto-pick if there's exactly one match
      submit(suggestions[0].title);
    }
    // Otherwise do nothing — user must pick from the list
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="text"
          placeholder={
            disabled
              ? "Game over"
              : `Guess the song (${attemptsLeft} left)...`
          }
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" disabled={disabled || suggestions.length === 0}>
          Guess
        </Button>
      </form>

      {showSuggestions && suggestions.length > 0 && !disabled && (
        <ul className="absolute z-50 bottom-full left-0 right-12 mb-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((song, i) => (
            <li
              key={`${song.title}-${song.artist}`}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onMouseDown={() => submit(song.title)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span>{song.title}</span>
              <span className="text-muted-foreground ml-2 text-xs">{song.artist}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
