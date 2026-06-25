import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyAppearance, autoDowngradeGlass, loadStylePreset, loadThemeMode } from "./lib/appearance";
import "./index.css";

const style = loadStylePreset();
applyAppearance(style, loadThemeMode(), style === "glass" ? autoDowngradeGlass() : undefined);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
