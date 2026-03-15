import { useState, useEffect } from "react";
import { Button } from "./ui/button";

// Bump this string whenever new features ship that returning users should know about.
// Format: "YYYY-MM-DD" matching the deploy date.
const CURRENT_VERSION = "2026-03-15";

const WELCOME_KEY = "strumdle-welcome-seen";
const SEEN_KEY = "strumdle-whats-new-seen";

const UPDATES: { version: string; items: string[] }[] = [
  {
    version: "2026-03-15",
    items: [
      "Past challenges are now playable — visit any previous day via the grid in the results modal",
      "Results modal shows a grid of all past challenges with your solve status"
    ],
  },
];

function getLastSeen(): string | null {
  try {
    const welcomeSeen = localStorage.getItem(WELCOME_KEY);
    if (!welcomeSeen) return null; // null = first-timer, don't show
    return localStorage.getItem(SEEN_KEY) ?? ""; // "" = returning, never seen whats-new
  } catch {
    return null;
  }
}

export default function WhatsNewModal() {
  const [visible, setVisible] = useState(false);
  const lastSeen = getLastSeen();
  // null = first-timer (don't show); "" = never seen (show all); version string = show newer only
  const [show, setShow] = useState(() => lastSeen !== null && lastSeen !== CURRENT_VERSION);

  useEffect(() => {
    if (show) {
      requestAnimationFrame(() => setVisible(true));
    }
  }, [show]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => setShow(false), 300);
    try {
      localStorage.setItem(SEEN_KEY, CURRENT_VERSION);
    } catch { /* ignore */ }
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
        className={`relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh] transition-all duration-500 ${
          visible ? "opacity-100" : "opacity-0"
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
          <div className="text-4xl mb-2">🆕</div>
          <h2 className="text-xl font-bold tracking-tight">What&apos;s New</h2>
          <p className="text-xs text-muted-foreground mt-1">Updates since your last visit</p>
        </div>

        {/* Update list */}
        <div className="px-6 pb-4 space-y-4">
          {UPDATES.map((update) => (
            <div key={update.version}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
                {update.version}
              </p>
              <ul className="space-y-2">
                {update.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 pt-2">
          <Button onClick={handleDismiss} className="w-full" size="lg">
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
