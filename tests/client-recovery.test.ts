import { afterEach, describe, expect, it, vi } from "vitest";
import { browserCommandApi } from "../lib/client/command-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("client recovery", () => {
  it("retries an interrupted create once with the same idempotency key", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("connection interrupted"))
      .mockResolvedValueOnce(
        Response.json(
          {
            priority: {
              id: "retry-safe-priority",
              title: "Retry safely",
              dueAt: null,
              status: "active",
              position: 0,
              isTop: true,
              source: "local",
              createdAt: "2026-07-26T12:00:00.000Z",
              updatedAt: "2026-07-26T12:00:00.000Z",
              completedAt: null,
            },
          },
          { status: 201 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      browserCommandApi.createPriority({ title: "Retry safely" }),
    ).resolves.toMatchObject({ id: "retry-safe-priority" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstInit = fetchMock.mock.calls[0]?.[1];
    const secondInit = fetchMock.mock.calls[1]?.[1];
    const firstKey = new Headers(firstInit?.headers).get("Idempotency-Key");
    const secondKey = new Headers(secondInit?.headers).get("Idempotency-Key");
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondKey).toBe(firstKey);
  });
});
