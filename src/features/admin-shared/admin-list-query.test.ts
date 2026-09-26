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

  it("keeps only valid review ratings in the query and link", () => {
    const query = parseAdminListQuery({ rating: "5", status: "published" });

    expect(query.rating).toBe("5");
    expect(toAdminListRpcQuery(query)).toMatchObject({ rating: "5" });
    expect(buildAdminListHref("/admin/avaliacoes", query, { page: 2 })).toBe(
      "/admin/avaliacoes?status=published&rating=5&page=2",
    );
    expect(parseAdminListQuery({ rating: "8" }).rating).toBeUndefined();
  });
});
