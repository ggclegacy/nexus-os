export type DatabaseValue =
  ArrayBuffer | bigint | boolean | null | number | string | undefined;

export interface PreparedStatement {
  bind(...values: DatabaseValue[]): PreparedStatement;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}

export interface NexusDatabase {
  prepare(sql: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<unknown>;
}
