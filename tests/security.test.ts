import { describe, expect, it } from "vitest";
import { authorizeRequest } from "../lib/server/access";
import { readJson } from "../lib/server/http";

function request(
  url: string,
  init: {
    fetchSite?: string;
    method?: string;
    origin?: string;
  } = {},
) {
  return new Request(url, {
    method: init.method ?? "GET",
    headers: {
      ...(init.fetchSite ? { "sec-fetch-site": init.fetchSite } : {}),
      ...(init.origin ? { origin: init.origin } : {}),
    },
  });
}

describe("request access boundary", () => {
  it("allows the public application to load on local and hosted origins", () => {
    expect(authorizeRequest(request("http://localhost:3000/"))).toEqual({
      state: "allowed",
    });
    expect(authorizeRequest(request("https://nexus.example/"))).toEqual({
      state: "allowed",
    });
  });

  it("allows same-origin hosted mutations", () => {
    expect(
      authorizeRequest(
        request("https://nexus.example/api/priorities", {
          method: "POST",
          origin: "https://nexus.example",
        }),
      ),
    ).toEqual({ state: "allowed" });
  });

  it("rejects cross-origin hosted mutations", () => {
    expect(
      authorizeRequest(
        request("https://nexus.example/api/priorities", {
          method: "POST",
          origin: "https://attacker.example",
        }),
      ),
    ).toEqual({ state: "forbidden" });
    expect(
      authorizeRequest(
        request("https://nexus.example/api/priorities", {
          fetchSite: "cross-site",
          method: "POST",
        }),
      ),
    ).toEqual({ state: "forbidden" });
  });
});

describe("JSON request boundary", () => {
  it("reports malformed JSON as a validation failure", async () => {
    const malformed = new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    await expect(readJson(malformed)).rejects.toThrow(
      "Request body contains invalid JSON.",
    );
  });

  it("rejects oversized request bodies before parsing", async () => {
    const oversized = new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notes: "x".repeat(70_000) }),
    });
    await expect(readJson(oversized)).rejects.toThrow(
      "Request body is too large.",
    );
  });
});
