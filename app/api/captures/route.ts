import { createCapture } from "../../../db/command-repository";
import { parseCapture } from "../../../lib/domain/validation";
import { jsonError, readJson, requestId } from "../../../lib/server/http";

export async function POST(request: Request) {
  try {
    const { content } = parseCapture(await readJson(request));
    const capture = await createCapture(content, requestId(request));
    return Response.json({ capture }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
