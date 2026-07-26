import { updateReminderInstance } from "../../../../db/time-repository";
import { ValidationError } from "../../../../lib/domain/validation";
import { jsonError, readJson } from "../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await readJson(request)) as {
      action?: unknown;
      snoozedUntil?: unknown;
    };
    if (
      !["seen", "snooze", "resolve", "dismiss"].includes(String(body.action))
    ) {
      throw new ValidationError("Reminder action is invalid.");
    }
    let snoozedUntil: string | null = null;
    if (body.action === "snooze") {
      if (
        typeof body.snoozedUntil !== "string" ||
        !Number.isFinite(Date.parse(body.snoozedUntil)) ||
        Date.parse(body.snoozedUntil) <= Date.now()
      ) {
        throw new ValidationError("Choose a future snooze time.");
      }
      snoozedUntil = new Date(body.snoozedUntil).toISOString();
    }
    const reminder = await updateReminderInstance(
      id,
      body.action as "seen" | "snooze" | "resolve" | "dismiss",
      snoozedUntil,
    );
    if (!reminder) {
      return Response.json({ error: "Reminder not found." }, { status: 404 });
    }
    return Response.json({ reminder });
  } catch (error) {
    return jsonError(error);
  }
}
