import { describe, expect, it } from "vitest";

import {
  buildAdminListHref,
  parseAdminListQuery,
  toAdminListRpcQuery,
} from "./admin-list-query";

describe("admin list query", () => {
  it("parses bounded filters and pagination from URL params", () => {
    const query = parseAdminListQuery({
      page: "2",
      pageSize: "500",
      q: " Ana Oliveira ",
      sort: "status",
      status: "approved",
    });

    expect(query).toEqual({
      page: 2,
      pageSize: 50,
      search: "Ana Oliveira",
      sort: "status",
      status: "approved",
    });
    expect(toAdminListRpcQuery(query)).toEqual({
      page: 2,
      pageSize: 50,
      search: "Ana Oliveira",
      sort: "status",
      status: "approved",
    });
  });

  it("drops invalid tokens and keeps clean hrefs", () => {
    const query = parseAdminListQuery({
      page: "not-a-number",
      q: "terapeuta",
      sort: "recent;drop",
      status: "approved",
    });

    expect(query.sort).toBe("");
    expect(buildAdminListHref("/admin/profissionais", query, { page: 3 })).toBe(
      "/admin/profissionais?q=terapeuta&status=approved&page=3",
    );
  });
});
