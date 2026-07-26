import {
  deletePriority,
  updatePriority,
} from "../../../../db/command-repository";
import { parsePriorityUpdate } from "../../../../lib/domain/validation";
import { jsonError, readJson } from "../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const priority = await updatePriority(
      id,
      parsePriorityUpdate(await readJson(request)),
    );
    if (!priority) {
      return Response.json({ error: "Priority not found." }, { status: 404 });
    }
    return Response.json({ priority });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const priority = await deletePriority(id);
    if (!priority) {
      return Response.json({ error: "Priority not found." }, { status: 404 });
    }
    return Response.json({ priority });
  } catch (error) {
    return jsonError(error);
  }
}
