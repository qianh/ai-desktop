import { describe, expect, it } from "vitest";
import { measurePageWebviewHorizontal } from "./pageWebviewBounds";

function mkEl(rect: DOMRect): HTMLElement {
  return {
    getBoundingClientRect: () => rect,
  } as HTMLElement;
}

function mkRect(x: number, y: number, width: number, height: number): DOMRect {
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height } as DOMRect;
}

describe("measurePageWebviewHorizontal", () => {
  it("returns sidebar and panel right edges", () => {
    const panel = mkEl(mkRect(246, 73, 954, 762));
    const sidebar = mkEl(mkRect(0, 39, 246, 821));
    const edges = measurePageWebviewHorizontal(panel, sidebar);
    expect(edges).toEqual({ sidebarRight: 246, panelRight: 1200 });
  });

  it("returns null when sidebar is missing", () => {
    const panel = mkEl(mkRect(246, 73, 954, 762));
    expect(measurePageWebviewHorizontal(panel, null)).toBeNull();
  });

  it("returns null when panel has zero size", () => {
    const panel = mkEl(mkRect(246, 73, 0, 762));
    const sidebar = mkEl(mkRect(0, 39, 246, 821));
    expect(measurePageWebviewHorizontal(panel, sidebar)).toBeNull();
  });

  it("returns null when sidebar has zero width", () => {
    const panel = mkEl(mkRect(246, 73, 954, 762));
    const sidebar = mkEl(mkRect(0, 39, 0, 821));
    expect(measurePageWebviewHorizontal(panel, sidebar)).toBeNull();
  });
});