import type { Replay, ReplayResult } from "@h2h/game";
import { useState } from "react";
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

export function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const home = () => setScreen({ name: "home" });

  switch (screen.name) {
    case "home":
      return (
        <Home
          onPlay={(setup) => setScreen({ name: "play", setup })}
          onWatch={(replay, title) => setScreen({ name: "replay", replay, title, back: { name: "home" } })}
          onHelp={() => setScreen({ name: "help" })}
          onCheck={() => setScreen({ name: "check" })}
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
          onQuit={home}
          onFinish={(replay, result) => {
            // Bests are kept for practice and each daily layout. Hand-picked seeds don't count.
            const isBest = setup.kind === "custom" ? false : recordScore(result.score, setup.day);
            setScreen({ name: "results", game: { setup, replay, result, isBest } });
          }}
        />
      );
    }
    case "results": {
      const { game } = screen;
      return (
        <Results
          {...game}
          onWatch={() =>
            setScreen({ name: "replay", replay: game.replay, title: `REPLAY · ${game.result.score}`, back: screen })
          }
          onAgain={() => setScreen({ name: "play", setup: againSetup(game.setup) })}
          onNew={() => setScreen({ name: "play", setup: practiceSetup() })}
          onHome={home}
        />
      );
    }
    case "replay":
      return <ReplayViewer replay={screen.replay} title={screen.title} onBack={() => setScreen(screen.back)} />;
  }
}
