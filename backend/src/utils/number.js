import { AppError } from './errors.js';

export function parseAmount(value, fieldName = 'amount') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new AppError(400, `${fieldName} must be a positive number.`);
  }
  return Number(numeric.toFixed(6));
}
