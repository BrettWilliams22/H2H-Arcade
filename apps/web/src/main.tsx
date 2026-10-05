import "@fontsource/press-start-2p/400.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { FONT } from "./game/renderer";

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
