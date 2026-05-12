import bcrypt from 'bcrypt';
import { pool } from './pool.js';

const LOGIN_ID_REGEX = /^[A-Za-z0-9]{4,30}$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;
const PHONE_REGEX = /^[0-9]{8,20}$/;

const readRequired = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`[admin:create] missing required env: ${name}`);
  }
  return value;
};

const validateInput = ({ loginId, password, phone }) => {
  if (!LOGIN_ID_REGEX.test(loginId)) {
    throw new Error('[admin:create] ADMIN_LOGIN_ID must be 4-30 chars (A-Z, a-z, 0-9).');
  }
  if (!PASSWORD_REGEX.test(password)) {
    throw new Error('[admin:create] ADMIN_PASSWORD must include letters, numbers, and special chars (8-64).');
  }
  if (!PHONE_REGEX.test(phone)) {
    throw new Error('[admin:create] ADMIN_PHONE must contain digits only (8-20).');
  }
};

async function main() {
  const loginId = readRequired('ADMIN_LOGIN_ID');
  const password = readRequired('ADMIN_PASSWORD');
  const name = readRequired('ADMIN_NAME');
  const phone = readRequired('ADMIN_PHONE');
  const email = readRequired('ADMIN_EMAIL').toLowerCase();
  const level = Number(process.env.ADMIN_LEVEL || 10);

  validateInput({ loginId, password, phone });
  const passwordHash = await bcrypt.hash(password, 12);

  const exists = await pool.query(
    'SELECT id, login_id, email FROM users WHERE login_id = $1 OR email = $2 LIMIT 1',
    [loginId, email]
  );

  if (exists.rowCount) {
    const row = exists.rows[0];
    console.log(`[admin:create] skipped (already exists): id=${row.id} login_id=${row.login_id} email=${row.email}`);
    return;
  }

  const created = await pool.query(
    `INSERT INTO users (
       login_id,
       password_hash,
       name,
       phone,
       email,
       role,
       status,
       email_verified_at,
       level
     )
     VALUES ($1, $2, $3, $4, $5, 'ADMIN', 'ACTIVE', NOW(), $6)
     RETURNING id, uid, login_id, email, role, status`,
    [loginId, passwordHash, name, phone, email, Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 10]
  );

  const row = created.rows[0];
  console.log(
    `[admin:create] created: id=${row.id} uid=${row.uid} login_id=${row.login_id} email=${row.email} role=${row.role} status=${row.status}`
  );
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[admin:create] failed:', error);
    await pool.end();
    process.exit(1);
  });
