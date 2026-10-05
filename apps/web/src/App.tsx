import type { Replay, ReplayResult } from "@h2h/game";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceCheck } from "./screens/DeviceCheck";
import { Help } from "./screens/Help";
import { Home } from "./screens/Home";
import { Play } from "./screens/Play";
import { ReplayViewer } from "./screens/ReplayViewer";
import { Results } from "./screens/Results";
import { type GameSetup, againSetup, practiceSetup } from "./setup";
import { recordScore } from "./storage";

interface Finished {
  setup: GameSetup;
  replay: Replay;
  result: ReplayResult;
  isBest: boolean;
}

type Screen =
  | { name: "home" }
  | { name: "help" }
  | { name: "check" }
  | { name: "play"; setup: GameSetup }
  | { name: "results"; game: Finished }
  | { name: "replay"; replay: Replay; title: string; back: Screen };

function initialScreen(): Screen {
  return window.location.hash === "#/check" ? { name: "check" } : { name: "home" };
}

/** Which of our history entries the browser is on: none (the page's own), the app, or a replay opened from Results. */
type Entry = "app" | "replay";

function entryOf(state: unknown): Entry | null {
  const value = (state as { brickstorm?: unknown } | null)?.brickstorm;
  return value === "app" || value === "replay" ? value : null;
}

/**
 * Adds a history entry, but only during a tap, click or key press. Browsers
 * skip entries a page adds at any other moment, which would make the Back
 * button jump right out of the site.
 */
function pushEntry(entry: Entry): void {
  const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  if (activation && !activation.isActive) return;
  history.pushState({ brickstorm: entry }, "");
}

function clearHash(): void {
  if (window.location.hash) history.replaceState(history.state, "", window.location.pathname + window.location.search);
}

function replayOf(game: Finished, back: Screen): Screen {
  return { name: "replay", replay: game.replay, title: `REPLAY · ${game.result.score}`, back };
}

/**
 * Screen switching, wired to the browser's history so the phone's Back button
 * works. Leaving Home adds one history entry, and a replay opened from Results
 * adds another. Back during a game pauses it (pressing Back again while paused
 * leaves, like closing the game); Back elsewhere goes back a screen.
 *
 * Every decision is made from which entry the browser landed on, never from
 * flags, so fast taps and the Forward button can't confuse it.
 */
function useScreens() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const current = useRef(screen);
  current.current = screen;
  /** What Back does on the play screen (pause). Set by the play screen. */
  const backHandler = useRef<(() => void) | null>(null);

  const go = useCallback((next: Screen) => {
    clearHash();
    const entry = entryOf(history.state);
    const now = current.current;
    if (now.name === "results" && next.name === "replay") {
      pushEntry("replay");
    } else if (now.name === "replay" && entry === "replay") {
      // Leaving a replay opened from Results: step back over its entry. The
      // popstate that follows lands on the app's entry, which needs nothing.
      history.back();
    } else if (next.name !== "home" && entry === null) {
      pushEntry("app");
    }
    setScreen(next);
  }, []);

  /** After a Back press paused the game, resuming puts the app's entry back (resuming is a tap or key press). */
  const rearm = useCallback(() => {
    if (entryOf(history.state) === null) pushEntry("app");
  }, []);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const entry = entryOf(e.state);
      const now = current.current;
      if (entry === "replay") {
        // Forward into a replay from its Results screen.
        if (now.name === "results") setScreen(replayOf(now.game, now));
        return;
      }
      if (entry === "app") {
        if (now.name === "replay" && now.back.name === "results") setScreen(now.back);
        return;
      }
      // Back to the page's own entry.
      if (now.name === "play") backHandler.current?.();
      else if (now.name !== "home") setScreen({ name: "home" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { screen, go, backHandler, rearm };
}

export function App() {
  const { screen, go, backHandler, rearm } = useScreens();
  const home = () => go({ name: "home" });

  switch (screen.name) {
    case "home":
      return (
        <Home
          onPlay={(setup) => go({ name: "play", setup })}
          onWatch={(replay, title) => go({ name: "replay", replay, title, back: { name: "home" } })}
          onHelp={() => go({ name: "help" })}
          onCheck={() => go({ name: "check" })}
        />
      );
    case "help":
      return <Help onBack={home} />;
    case "check":
      return <DeviceCheck onBack={home} />;
    case "play": {
      const { setup } = screen;
      return (
        <Play
          setup={setup}
          backHandler={backHandler}
          onResume={rearm}
          onQuit={home}
          onFinish={(replay, result) => {
            // Bests are kept for practice and each daily layout. Hand-picked seeds don't count.
            const isBest = setup.kind === "custom" ? false : recordScore(result.score, setup.day);
            go({ name: "results", game: { setup, replay, result, isBest } });
          }}
        />
      );
    }
    case "results": {
      const { game } = screen;
      return (
        <Results
          {...game}
          onWatch={() => go(replayOf(game, screen))}
          onAgain={() => go({ name: "play", setup: againSetup(game.setup) })}
          onNew={() => go({ name: "play", setup: practiceSetup() })}
          onHome={home}
        />
      );
    }
    case "replay":
      return <ReplayViewer replay={screen.replay} title={screen.title} onBack={() => go(screen.back)} />;
  }
}
