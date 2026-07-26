import { createTimelineItem } from "../../../db/command-repository";
import { parseTimelineInput } from "../../../lib/domain/validation";
import { jsonError, readJson, requestId } from "../../../lib/server/http";

export async function POST(request: Request) {
  try {
    const item = await createTimelineItem(
      parseTimelineInput(await readJson(request)),
      requestId(request),
    );
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
