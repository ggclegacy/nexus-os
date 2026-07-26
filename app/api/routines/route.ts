import { createRoutine, listRoutines } from "../../../db/time-repository";
import { parseRoutine } from "../../../lib/time/validation";
import { jsonError, readJson, requestId } from "../../../lib/server/http";

export async function GET() {
  try {
    return Response.json({ routines: await listRoutines() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const routine = await createRoutine(
      parseRoutine(await readJson(request)),
      requestId(request),
    );
    return Response.json({ routine }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
