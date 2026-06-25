import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyAppearance, loadStylePreset, loadThemeMode } from "./lib/appearance";
import "./index.css";

applyAppearance(loadStylePreset(), loadThemeMode());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
