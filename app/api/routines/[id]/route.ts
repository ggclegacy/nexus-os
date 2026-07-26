import { archiveRoutine, updateRoutine } from "../../../../db/time-repository";
import { parseRoutine } from "../../../../lib/time/validation";
import { jsonError, readJson } from "../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const routine = await updateRoutine(
      id,
      parseRoutine(await readJson(request)),
    );
    if (!routine) {
      return Response.json({ error: "Routine not found." }, { status: 404 });
    }
    return Response.json({ routine });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const routine = await archiveRoutine(id);
    if (!routine) {
      return Response.json({ error: "Routine not found." }, { status: 404 });
    }
    return Response.json({ routine });
  } catch (error) {
    return jsonError(error);
  }
}
