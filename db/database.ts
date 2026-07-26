import {
  createClient,
  type Client,
  type InStatement,
  type InValue,
} from "@libsql/client";
import type {
  DatabaseValue,
  NexusDatabase,
  PreparedStatement,
} from "./database-contract";

function normalizeValue(value: DatabaseValue): InValue {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

class LibsqlPreparedStatement implements PreparedStatement {
  private values: InValue[] = [];

  constructor(
    private readonly client: Client,
    private readonly sql: string,
  ) {}

  bind(...values: DatabaseValue[]) {
    this.values = values.map(normalizeValue);
    return this;
  }

  statement(): InStatement {
    return { sql: this.sql, args: this.values };
  }

  async run() {
    return this.client.execute(this.statement());
  }

  async first<T>() {
    const result = await this.client.execute(this.statement());
    return (result.rows[0] as T | undefined) ?? null;
  }

  async all<T>() {
    const result = await this.client.execute(this.statement());
    return { results: result.rows as unknown as T[] };
  }
}

class LibsqlDatabase implements NexusDatabase {
  constructor(private readonly client: Client) {}

  prepare(sql: string) {
    return new LibsqlPreparedStatement(this.client, sql);
  }

  async batch(statements: PreparedStatement[]) {
    const libsqlStatements = statements.map((statement) => {
      if (!(statement instanceof LibsqlPreparedStatement)) {
        throw new Error("Cannot batch statements from another database.");
      }
      return statement.statement();
    });
    return this.client.batch(libsqlStatements, "write");
  }
}

let databaseInstance: NexusDatabase | null = null;

export function database(): NexusDatabase {
  if (databaseInstance) return databaseInstance;

  const url = process.env.TURSO_DATABASE_URL;
  if (!url && process.env.VERCEL) {
    throw new Error(
      "Turso is not configured. Add the Turso integration in Vercel or set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    );
  }

  databaseInstance = new LibsqlDatabase(
    createClient({
      url: url ?? "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    }),
  );
  return databaseInstance;
}
