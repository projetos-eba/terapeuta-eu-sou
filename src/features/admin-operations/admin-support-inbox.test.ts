import { describe, expect, it } from "vitest";

import {
  buildAdminSupportInboxHref,
  parseAdminSupportInboxQuery,
} from "./admin-support-inbox";

describe("admin support inbox query", () => {
  it("keeps only allowlisted filters and a bounded page size", () => {
    expect(
      parseAdminSupportInboxQuery({
        assignment: "me",
        category: "financeiro_repasses",
        page: "3",
        pageSize: "100",
        persona: "therapist",
        priority: "high",
        q: "  Repasse pendente  ",
        status: "waiting_support",
      }),
    ).toEqual({
      assignment: "me",
      category: "financeiro_repasses",
      page: 3,
      pageSize: 50,
      persona: "therapist",
      priority: "high",
      search: "Repasse pendente",
      status: "waiting_support",
    });
  });

  it("drops unsupported filter tokens and preserves filters in links", () => {
    const query = parseAdminSupportInboxQuery({
      assignment: "another-admin",
      persona: "admin",
      priority: "critical",
      status: "closed",
    });
    expect(query).toMatchObject({
      assignment: "",
      persona: "",
      priority: "",
      status: "",
    });
    expect(
      buildAdminSupportInboxHref(query, { status: "waiting_support" }),
    ).toBe("/admin/suporte?status=waiting_support");
  });
});
