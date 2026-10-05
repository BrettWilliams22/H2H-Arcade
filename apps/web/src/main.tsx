import "@fontsource/press-start-2p/400.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { FONT } from "./game/renderer";
import { sound } from "./game/sound";

// Browsers only allow sound after a tap or key press. Unlocking on every one
// (it's cheap once unlocked) also recovers sound after a phone call or app switch.
// (On touch screens only the end of a tap counts, hence pointerup and touchend.)
for (const type of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
  document.addEventListener(type, () => sound.unlock(), { capture: true });
}

// The game draws text on the canvas, so make sure the pixel font is ready first.
void document.fonts.load(`8px ${FONT}`).finally(() => {
  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
});
