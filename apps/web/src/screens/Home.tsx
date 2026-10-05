import { type Replay, runReplay, validateReplay } from "@h2h/game";
import { useEffect, useRef, useState } from "react";
import { parseSeed, todayKey } from "../game/seeds";
import { sound } from "../game/sound";
import { type GameSetup, customSetup, dailySetup, practiceSetup } from "../setup";
import { loadBests } from "../storage";

/** A real recording is well under 100 KB; refuse anything much bigger before reading it. */
const MAX_RECORDING_BYTES = 512 * 1024;

interface Props {
  onPlay: (setup: GameSetup) => void;
  onWatch: (replay: Replay, title: string) => void;
  onHelp: () => void;
  onCheck: () => void;
}

export function Home({ onPlay, onWatch, onHelp, onCheck }: Props) {
  const [bests] = useState(loadBests);
  const [seedText, setSeedText] = useState("");
  const [seedError, setSeedError] = useState("");
  const [fileError, setFileError] = useState("");
  const [muted, setMuted] = useState(sound.muted);
  const [today, setToday] = useState(todayKey);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // The daily layout changes at midnight UTC; refresh the label when the player comes back to the page.
    const refresh = () => setToday(todayKey());
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 60_000);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(timer);
    };
  }, []);

  const start = (setup: GameSetup) => {
    onPlay(setup);
  };

  const playSeed = () => {
    const seed = parseSeed(seedText);
    if (seed === null) {
      setSeedError("Enter a whole number from 0 to 4294967295.");
      return;
    }
    start(customSetup(seed));
  };

  const openRecording = async (file: File | undefined) => {
    if (!file) return;
    setFileError("");
    if (file.size > MAX_RECORDING_BYTES) {
      setFileError("That file is too big to be a Brickstorm recording.");
      return;
    }
    try {
      const text = await file.text();
      if (!mounted.current) return; // the player has moved on to another screen
      const checked = validateReplay(JSON.parse(text));
      if (!checked.ok) {
        setFileError(`That recording was rejected: ${checked.error}`);
        return;
      }
      // Title it with the score the game computes, never a number from the file name.
      onWatch(checked.replay, `REPLAY · ${runReplay(checked.replay).score}`);
    } catch {
      if (mounted.current) setFileError("That file isn't a Brickstorm recording.");
    }
  };

  const toggleSound = () => {
    sound.setMuted(!muted);
    setMuted(!muted);
  };

  return (
    <div className="screen menu-screen">
      <header className="title">
        <h1>
          BRICK<span>STORM</span>
        </h1>
        <p>Same bricks. Same seed. Best score wins.</p>
      </header>

      <div className="panel menu">
        <button type="button" className="btn primary" onClick={() => start(practiceSetup())}>
          PRACTICE
          <small>New layout · best {bests.practice}</small>
        </button>
        <button type="button" className="btn" onClick={() => start(dailySetup())}>
          DAILY LAYOUT
          <small>
            Same for everyone today · best {bests.daily[today] ?? 0}
          </small>
        </button>

        <form
          className="seed-form"
          onSubmit={(e) => {
            e.preventDefault();
            playSeed();
          }}
        >
          <label htmlFor="seed">Play a seed</label>
          <div className="row">
            <input
              id="seed"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 42"
              value={seedText}
              onChange={(e) => {
                setSeedText(e.target.value);
                setSeedError("");
              }}
            />
            <button type="submit" className="btn small">
              GO
            </button>
          </div>
          {seedError && <p className="error">{seedError}</p>}
        </form>

        <label className="btn file-btn">
          WATCH A RECORDING
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              void openRecording(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {fileError && <p className="error">{fileError}</p>}

        <div className="row">
          <button type="button" className="btn ghost" onClick={onHelp}>
            HOW TO PLAY
          </button>
          <button type="button" className="btn ghost" onClick={onCheck}>
            DEVICE CHECK
          </button>
        </div>
        <button type="button" className="btn ghost" onClick={toggleSound} aria-pressed={!muted}>
          SOUND: {muted ? "OFF" : "ON"}
        </button>
      </div>

      <footer className="fine">Test version · practice only · no money involved</footer>
    </div>
  );
}
