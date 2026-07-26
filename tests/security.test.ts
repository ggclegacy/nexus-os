import { describe, expect, it } from "vitest";
import { authorizePrivateRequest } from "../lib/server/access";
import { readJson } from "../lib/server/http";

function request(
  url: string,
  init: { authorization?: string; method?: string; origin?: string } = {},
) {
  return new Request(url, {
    method: init.method ?? "GET",
    headers: {
      ...(init.authorization ? { authorization: init.authorization } : {}),
      ...(init.origin ? { origin: init.origin } : {}),
    },
  });
}

describe("private access boundary", () => {
  const environment = {
    NEXUS_ACCESS_USERNAME: "owner",
    NEXUS_ACCESS_PASSWORD: "correct horse battery staple",
  };

  it("keeps localhost usable without weakening hosted access", () => {
    expect(
      authorizePrivateRequest(request("http://localhost:3000/"), {}),
    ).toEqual({ state: "allowed" });
    expect(
      authorizePrivateRequest(request("https://nexus.example/"), {}),
    ).toEqual({ state: "configuration-required" });
  });

  it("accepts valid hosted credentials and rejects invalid credentials", () => {
    const valid = `Basic ${btoa("owner:correct horse battery staple")}`;
    const invalid = `Basic ${btoa("owner:incorrect")}`;
    expect(
      authorizePrivateRequest(
        request("https://nexus.example/", { authorization: valid }),
        environment,
      ),
    ).toEqual({ state: "allowed" });
    expect(
      authorizePrivateRequest(
        request("https://nexus.example/", { authorization: invalid }),
        environment,
      ),
    ).toEqual({ state: "unauthorized" });
  });

  it("rejects cross-origin hosted mutations", () => {
    expect(
      authorizePrivateRequest(
        request("https://nexus.example/api/priorities", {
          authorization: `Basic ${btoa("owner:correct horse battery staple")}`,
          method: "POST",
          origin: "https://attacker.example",
        }),
        environment,
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
