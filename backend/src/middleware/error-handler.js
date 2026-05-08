import { toAppError } from '../utils/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: 'Not found.'
    }
  });
}

export function errorHandler(err, req, res, next) {
  const appError = toAppError(err);

  if (appError.status >= 500) {
    console.error(err);
  }

  res.status(appError.status).json({
    error: {
      message: appError.message,
      details: appError.details || undefined
    }
  });
}
