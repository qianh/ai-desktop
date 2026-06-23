import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEFAULT_PAGE_REMOVED_KEY,
  DEFAULT_PAGE_URL,
  ensureDefaultPage,
  hasDefaultPageUrl,
  isDefaultPageRemoved,
  isDefaultPageSeeded,
  markDefaultPageRemoved,
  markDefaultPageSeeded,
  pickStartupPageId,
  shouldEnsureDefaultPage,
  shouldSkipSystemUpstream,
} from "./ensureDefaultPage";
import * as api from "../api";

vi.mock("../api", () => ({
  listPages: vi.fn(),
  savePage: vi.fn(),
  setPageInterceptReporting: vi.fn(),
}));

function mockStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    _data: data,
  };
}

describe("shouldEnsureDefaultPage", () => {
  it("seeds when empty and not yet seeded", () => {
    expect(shouldEnsureDefaultPage(0, false, false, false)).toBe(true);
  });

  it("skips when default URL already exists", () => {
    expect(shouldEnsureDefaultPage(3, true, false, false)).toBe(false);
  });

  it("seeds when other pages exist but default URL missing and not yet seeded", () => {
    expect(shouldEnsureDefaultPage(3, false, false, false)).toBe(true);
  });

  it("skips re-seeding when already seeded even if default URL missing", () => {
    expect(shouldEnsureDefaultPage(3, false, true, false)).toBe(false);
  });

  it("skips when user explicitly removed default page", () => {
    expect(shouldEnsureDefaultPage(2, false, true, true)).toBe(false);
  });

  it("skips when empty but already seeded (user deleted all pages)", () => {
    expect(shouldEnsureDefaultPage(0, false, true, false)).toBe(false);
  });
});

describe("pickStartupPageId", () => {
  it("prefers default page URL over first page", () => {
    expect(
      pickStartupPageId([
        { id: "chatgpt", host: "https://chatgpt.com/" },
        { id: "default", host: DEFAULT_PAGE_URL },
      ]),
    ).toBe("default");
  });

  it("falls back to first page when default missing", () => {
    expect(
      pickStartupPageId([{ id: "chatgpt", host: "https://chatgpt.com/" }]),
    ).toBe("chatgpt");
  });
});

describe("shouldSkipSystemUpstream", () => {
  it("is true only for the built-in chat URL", () => {
    expect(shouldSkipSystemUpstream(DEFAULT_PAGE_URL)).toBe(true);
    expect(shouldSkipSystemUpstream("https://chat.worldwide-logistics.cn/chat/")).toBe(true);
    expect(shouldSkipSystemUpstream("https://chatgpt.com/")).toBe(false);
  });
});

describe("hasDefaultPageUrl", () => {
  it("detects matching URL", () => {
    expect(
      hasDefaultPageUrl([
        { url: "https://chatgpt.com/" },
        { url: DEFAULT_PAGE_URL },
      ]),
    ).toBe(true);
  });
});

describe("ensureDefaultPage", () => {
  beforeEach(() => {
    vi.mocked(api.listPages).mockReset();
    vi.mocked(api.savePage).mockReset();
    vi.mocked(api.setPageInterceptReporting).mockReset();
    vi.mocked(api.setPageInterceptReporting).mockImplementation(async (pageId) => ({
      id: pageId,
      name: "chat.worldwide-logistics.cn",
      url: DEFAULT_PAGE_URL,
      status: "idle",
      intercept_reporting_enabled: true,
    }));
  });

  it("creates default page on first empty database", async () => {
    const storage = mockStorage();
    vi.mocked(api.listPages).mockResolvedValue([]);
    vi.mocked(api.savePage).mockResolvedValue({
      id: "page-1",
      name: "chat.worldwide-logistics.cn",
      url: DEFAULT_PAGE_URL,
      status: "idle",
      intercept_reporting_enabled: false,
    });

    const seeded = await ensureDefaultPage(storage);

    expect(seeded).toBe(true);
    expect(api.savePage).toHaveBeenCalledWith("Chat", DEFAULT_PAGE_URL);
    expect(api.setPageInterceptReporting).toHaveBeenCalledWith("page-1", true);
    expect(isDefaultPageSeeded(storage)).toBe(true);
  });

  it("creates default page when other pages exist but URL missing", async () => {
    const storage = mockStorage();
    vi.mocked(api.listPages).mockResolvedValue([
      {
        id: "chatgpt",
        name: "chatgpt.com",
        url: "https://chatgpt.com/",
        status: "idle",
        intercept_reporting_enabled: false,
      },
    ]);
    vi.mocked(api.savePage).mockResolvedValue({
      id: "page-default",
      name: "chat.worldwide-logistics.cn",
      url: DEFAULT_PAGE_URL,
      status: "idle",
      intercept_reporting_enabled: false,
    });

    const seeded = await ensureDefaultPage(storage);

    expect(seeded).toBe(true);
    expect(api.savePage).toHaveBeenCalledWith("Chat", DEFAULT_PAGE_URL);
  });

  it("skips when default URL already exists", async () => {
    const storage = mockStorage();
    vi.mocked(api.listPages).mockResolvedValue([
      {
        id: "existing",
        name: "chat.worldwide-logistics.cn",
        url: DEFAULT_PAGE_URL,
        status: "idle",
        intercept_reporting_enabled: false,
      },
    ]);

    const seeded = await ensureDefaultPage(storage);

    expect(seeded).toBe(false);
    expect(api.savePage).not.toHaveBeenCalled();
  });

  it("skips when user removed default page", async () => {
    const storage = mockStorage();
    markDefaultPageRemoved(storage);
    vi.mocked(api.listPages).mockResolvedValue([
      {
        id: "chatgpt",
        name: "chatgpt.com",
        url: "https://chatgpt.com/",
        status: "idle",
        intercept_reporting_enabled: false,
      },
    ]);

    const seeded = await ensureDefaultPage(storage);

    expect(seeded).toBe(false);
    expect(api.savePage).not.toHaveBeenCalled();
    expect(isDefaultPageRemoved(storage)).toBe(true);
  });

  it("skips when empty but seed flag already set", async () => {
    const storage = mockStorage();
    markDefaultPageSeeded(storage);
    vi.mocked(api.listPages).mockResolvedValue([]);

    const seeded = await ensureDefaultPage(storage);

    expect(seeded).toBe(false);
    expect(api.savePage).not.toHaveBeenCalled();
    expect(storage._data[DEFAULT_PAGE_REMOVED_KEY]).toBeUndefined();
  });
});