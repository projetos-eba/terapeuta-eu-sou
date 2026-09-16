import { describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("closed participant send route", () => {
  it("returns 410 without contacting Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/messages/send-template", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(410);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
