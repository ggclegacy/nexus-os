import { createPriority, listPriorities } from "../../../db/command-repository";
import { parsePriorityInput } from "../../../lib/domain/validation";
import { jsonError, readJson } from "../../../lib/server/http";

export async function POST(request: Request) {
  try {
    const priority = await createPriority(
      parsePriorityInput(await readJson(request)),
    );
    return Response.json({ priority }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  try {
    return Response.json({ priorities: await listPriorities() });
  } catch (error) {
    return jsonError(error);
  }
}
