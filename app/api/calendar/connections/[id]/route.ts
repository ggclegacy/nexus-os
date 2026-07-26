import {
  disconnectCalendarConnection,
  recordCalendarAudit,
} from "../../../../../db/calendar-intelligence-repository";
import { ValidationError } from "../../../../../lib/domain/validation";
import { revokeGoogleConnection } from "../../../../../lib/server/google-calendar";
import { jsonError, readJson } from "../../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await readJson(request)) as { retention?: unknown };
    if (!["remove", "snapshot"].includes(String(body.retention))) {
      throw new ValidationError("Choose how imported data should be retained.");
    }
    await revokeGoogleConnection(id);
    await disconnectCalendarConnection(
      id,
      body.retention as "remove" | "snapshot",
    );
    await recordCalendarAudit({
      actor: "owner",
      action: "disconnect",
      source: "google",
      eventIds: [],
      summary:
        body.retention === "snapshot"
          ? "Disconnected Google and retained a read-only local snapshot."
          : "Disconnected Google and removed its cached local events.",
      providerResult: null,
    });
    return Response.json({ disconnected: true, retention: body.retention });
  } catch (error) {
    return jsonError(error);
  }
}
