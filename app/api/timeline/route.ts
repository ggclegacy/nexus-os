import { createTimelineItem } from "../../../db/command-repository";
import { parseTimelineInput } from "../../../lib/domain/validation";
import { jsonError, readJson } from "../../../lib/server/http";

export async function POST(request: Request) {
  try {
    const item = await createTimelineItem(
      parseTimelineInput(await readJson(request)),
    );
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
