import {
  deleteTimelineItem,
  updateTimelineItem,
} from "../../../../db/command-repository";
import { parseTimelineUpdate } from "../../../../lib/domain/validation";
import { jsonError, readJson } from "../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const item = await updateTimelineItem(
      id,
      parseTimelineUpdate(await readJson(request)),
    );
    if (!item) {
      return Response.json(
        { error: "Timeline item not found." },
        { status: 404 },
      );
    }
    return Response.json({ item });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const item = await deleteTimelineItem(id);
    if (!item) {
      return Response.json(
        { error: "Timeline item not found." },
        { status: 404 },
      );
    }
    return Response.json({ item });
  } catch (error) {
    return jsonError(error);
  }
}
