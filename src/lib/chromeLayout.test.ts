import { describe, expect, it } from "vitest";
import {
  APP_SIDEBAR_DEFAULT_W,
  APP_SIDEBAR_ICON_RAIL_W,
  APP_TITLE_BAR_H,
} from "./chromeLayout";

describe("chromeLayout contract", () => {
  it("uses 48px workspace header per layout-shell spec", () => {
    expect(APP_TITLE_BAR_H).toBe(48);
  });

  it("defaults sidebar width to 264px", () => {
    expect(APP_SIDEBAR_DEFAULT_W).toBe(264);
  });

  it("uses 40px icon rail when collapsed", () => {
    expect(APP_SIDEBAR_ICON_RAIL_W).toBe(40);
  });
});