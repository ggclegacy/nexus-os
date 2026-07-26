import { reorderPriorities } from "../../../../db/command-repository";
import { parseReorder } from "../../../../lib/domain/validation";
import { jsonError, readJson } from "../../../../lib/server/http";

export async function PATCH(request: Request) {
  try {
    const priorities = await reorderPriorities(
      parseReorder(await readJson(request)),
    );
    return Response.json({ priorities });
  } catch (error) {
    return jsonError(error);
  }
}
