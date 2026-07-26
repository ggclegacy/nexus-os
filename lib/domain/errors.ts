export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "This request is not allowed.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
