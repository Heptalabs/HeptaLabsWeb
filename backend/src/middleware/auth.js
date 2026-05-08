import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new AppError(401, 'Unauthorized.'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: Number(payload.sub),
      uid: Number(payload.uid),
      role: payload.role,
      loginId: payload.loginId
    };
    return next();
  } catch (err) {
    return next(new AppError(401, 'Invalid token.'));
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
    return next(new AppError(403, 'Admin role is required.'));
  }
  return next();
}
