import { useState, useEffect } from "react";
import { Button } from "./ui/button";

const SEEN_KEY = "strumdle-welcome-seen";

function shouldShow() {
  try {
    return !localStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

export default function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [show, setShow] = useState(shouldShow);

  useEffect(() => {
    if (show) {
      requestAnimationFrame(() => setVisible(true));
    }
  }, [show]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => setShow(false), 300);
    localStorage.setItem(SEEN_KEY, "1");
  };

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
      onClick={handleDismiss}
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
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
        >
          &times;
        </button>

        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <div className="text-4xl mb-2">🎸</div>
          <h2 className="text-xl font-bold tracking-tight">
            Welcome to Strumdle!
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 pb-4 text-sm text-muted-foreground space-y-3">
          <p>
            A daily guessing game inspired by Guitar Hero. You'll see a note
            chart scroll down the screen &mdash; your job is to figure out which
            song it is.
          </p>
          <p>
            Press <strong className="text-foreground">Play</strong> to watch the
            chart, then type your guess. You get 6 attempts, and the chart
            reveals more with each wrong guess.
          </p>
          <p className="text-xs border border-border rounded-lg px-3 py-2 bg-muted/40">
            🔊 <strong className="text-foreground">Heads up:</strong> the sounds
            are simulated &mdash; not from the real recordings. Trust the note
            patterns! You can swap guitar sounds from the audio controls.
          </p>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 pt-2">
          <Button onClick={handleDismiss} className="w-full" size="lg">
            Let's go!
          </Button>
        </div>
      </div>
    </div>
  );
}
