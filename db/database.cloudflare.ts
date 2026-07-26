import { env } from "cloudflare:workers";
import type { NexusDatabase } from "./database-contract";

export function database(): NexusDatabase {
  if (!env.DB) {
    throw new Error("Local command storage is unavailable.");
  }
  return env.DB;
}
