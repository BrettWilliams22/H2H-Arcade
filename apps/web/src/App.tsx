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

/**
 * Screen switching, wired to the browser's history so the phone's Back button
 * works: during a game it pauses, elsewhere it goes back a screen instead of
 * leaving the site. One extra history entry is kept while away from Home.
 */
function useScreens() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const current = useRef(screen);
  current.current = screen;
  const hasEntry = useRef(false);
  const ignoreNextPop = useRef(false);
  /** What Back does on the current screen, if it's special (the play screen pauses). */
  const backHandler = useRef<(() => void) | null>(null);

  const go = useCallback((next: Screen) => {
    if (window.location.hash) history.replaceState(history.state, "", window.location.pathname + window.location.search);
    if (next.name === "home") {
      if (hasEntry.current) {
        hasEntry.current = false;
        ignoreNextPop.current = true;
        history.back();
      }
    } else if (!hasEntry.current) {
      history.pushState({ brickstorm: true }, "");
      hasEntry.current = true;
    }
    setScreen(next);
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (ignoreNextPop.current) {
        ignoreNextPop.current = false;
        return;
      }
      hasEntry.current = false;
      const now = current.current;
      if (now.name === "home") return;
      if (now.name === "play") {
        // Stay in the game, paused, and keep the entry so the next Back is caught too.
        backHandler.current?.();
        history.pushState({ brickstorm: true }, "");
        hasEntry.current = true;
        return;
      }
      if (now.name === "replay") go(now.back);
      else setScreen({ name: "home" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [go]);

  return { screen, go, backHandler };
}

export function App() {
  const { screen, go, backHandler } = useScreens();
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
          onWatch={() => go({ name: "replay", replay: game.replay, title: `REPLAY · ${game.result.score}`, back: screen })}
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
