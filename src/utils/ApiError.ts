export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }
  static validation(details: unknown, message = "Données invalides") {
    return new ApiError(422, "VALIDATION_ERROR", message, details);
  }
  static unauthorized(message = "Authentification requise") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "Vous n'avez pas les droits nécessaires") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Ressource introuvable") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message: string, details?: unknown) {
    return new ApiError(409, "CONFLICT", message, details);
  }
}
