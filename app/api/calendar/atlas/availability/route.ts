import { getTimePreferences } from "../../../../../db/time-repository";
import { findAvailability } from "../../../../../lib/calendar-intelligence/deterministic";
import type { AvailabilityRequest } from "../../../../../lib/calendar-intelligence/types";
import { ValidationError } from "../../../../../lib/domain/validation";
import { availabilityCalendarEvents } from "../../../../../lib/server/calendar-intelligence-service";
import { jsonError, readJson } from "../../../../../lib/server/http";
import { daysBetween } from "../../../../../lib/time/rules";
import { parseDateKey } from "../../../../../lib/time/validation";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const durationMinutes = Number(body.durationMinutes);
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 15 ||
      durationMinutes > 480
    ) {
      throw new ValidationError("Duration must be between 15 minutes and 8 hours.");
    }
    const startDate = parseDateKey(body.startDate, "Start date");
    const endDate = parseDateKey(body.endDate, "End date");
    if (daysBetween(startDate, endDate) < 0 || daysBetween(startDate, endDate) > 31) {
      throw new ValidationError("Availability range must be 31 days or fewer.");
    }
    if (
      !["any", "morning", "afternoon", "evening"].includes(
        String(body.preferredPeriod),
      )
    ) {
      throw new ValidationError("Preferred time of day is invalid.");
    }
    const availabilityRequest: AvailabilityRequest = {
      durationMinutes,
      startDate,
      endDate,
      preferredPeriod:
        body.preferredPeriod as AvailabilityRequest["preferredPeriod"],
    };
    const [events, preferences] = await Promise.all([
      availabilityCalendarEvents(startDate, endDate),
      getTimePreferences(),
    ]);
    return Response.json({
      request: availabilityRequest,
      slots: findAvailability(events, preferences, availabilityRequest),
    });
  } catch (error) {
    return jsonError(error);
  }
}
