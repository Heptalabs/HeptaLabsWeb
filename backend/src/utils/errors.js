export class AppError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

export function toAppError(err) {
  if (err instanceof AppError) {
    return err;
  }

  if (err?.code === '23505') {
    return new AppError(409, 'Duplicate resource.');
  }

  return new AppError(500, 'Internal server error.');
}
