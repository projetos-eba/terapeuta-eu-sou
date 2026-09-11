import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicTherapies } from "./get-public-therapies";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getPublicTherapies", () => {
  it("orders recently added therapies by their registration date", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://catalog.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response("[]", {
        headers: { "content-range": "0-0/0" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getPublicTherapies({
      page: 1,
      pageSize: 16,
      sort: "newest",
    });

    const listUrl = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .find((url) => url.searchParams.has("order"));

    expect(listUrl?.searchParams.get("order")).toBe(
      "created_at.desc.nullslast,name.asc",
    );
  });
});
