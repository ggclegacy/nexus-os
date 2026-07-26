import { assembleCommandData } from "../../../lib/server/command-service";

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function validTimeZone(value: string | null) {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const timeZone = validTimeZone(url.searchParams.get("timeZone"));
  const localDate =
    validDate(url.searchParams.get("date")) ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  const data = await assembleCommandData(localDate, timeZone);
  return Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
