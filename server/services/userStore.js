import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEFAULT_ADMIN_USERNAME = 'bonapapa394';
const DEFAULT_ADMIN_PASSWORD = 'AdobePh55393#ho';
const DEFAULT_ADMIN_EMAIL = 'bonapapa394@local.account';

fs.mkdirSync(DATA_DIR, { recursive: true });

function nowSeconds() { return Math.floor(Date.now() / 1000); }

function initialData() { return { last_id: 0, users: [] }; }

export function loadUsersData() {
  if (!fs.existsSync(USERS_FILE)) saveUsersData(initialData());
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!data || !Array.isArray(data.users)) return initialData();
    return data;
  } catch {
    return initialData();
  }
}

export function saveUsersData(data) {
  const tmp = `${USERS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, USERS_FILE);
}

export async function ensureSeedUser() {
  const data = loadUsersData();
  const idx = data.users.findIndex(u => u.username === DEFAULT_ADMIN_USERNAME);
  const ts = nowSeconds();
  if (idx >= 0) {
    const u = data.users[idx];
    u.email_verified_at = u.email_verified_at || ts;
    u.whatsapp_verified_at = u.whatsapp_verified_at || ts;
    u.role = 'admin';
    u.updated_at = ts;
    data.users[idx] = u;
    saveUsersData(data);
    return u;
  }
  data.last_id = Number(data.last_id || 0) + 1;
  const record = {
    id: data.last_id,
    username: DEFAULT_ADMIN_USERNAME,
    email: DEFAULT_ADMIN_EMAIL,
    mobile: '0000000000',
    password_hash: await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12),
    email_verification_code: null,
    email_code_expires: null,
    email_verified_at: ts,
    whatsapp_verification_code: null,
    whatsapp_code_expires: null,
    whatsapp_verified_at: ts,
    role: 'admin',
    created_at: ts,
    updated_at: ts
  };
  data.users.push(record);
  saveUsersData(data);
  return record;
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, email_verification_code, whatsapp_verification_code, ...safe } = user;
  return safe;
}

export function findUserById(id) {
  const data = loadUsersData();
  return data.users.find(u => Number(u.id) === Number(id)) || null;
}

export function findUserByLogin(login) {
  const v = String(login || '').trim();
  const lower = v.toLowerCase();
  const data = loadUsersData();
  return data.users.find(u => u.username === v || String(u.email || '').toLowerCase() === lower) || null;
}

export async function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  const normalized = String(hash).replace(/^\$2y\$/, '$2b$');
  return bcrypt.compare(password, normalized);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function createUser(input) {
  const data = loadUsersData();
  const username = String(input.username || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  if (data.users.some(u => u.username === username || String(u.email || '').toLowerCase() === email)) {
    return { ok: false, error: 'Username or email already exists.' };
  }
  data.last_id = Number(data.last_id || 0) + 1;
  const ts = nowSeconds();
  const record = {
    id: data.last_id,
    username,
    email,
    mobile: String(input.mobile || '').trim(),
    password_hash: input.password_hash,
    email_verification_code: input.email_verification_code || null,
    email_code_expires: input.email_code_expires || null,
    email_verified_at: null,
    whatsapp_verification_code: null,
    whatsapp_code_expires: null,
    whatsapp_verified_at: null,
    role: 'user',
    created_at: ts,
    updated_at: ts
  };
  data.users.push(record);
  saveUsersData(data);
  return { ok: true, user: record };
}

export function updateUser(id, updates) {
  const data = loadUsersData();
  const idx = data.users.findIndex(u => Number(u.id) === Number(id));
  if (idx < 0) return null;
  data.users[idx] = { ...data.users[idx], ...updates, updated_at: nowSeconds() };
  saveUsersData(data);
  return data.users[idx];
}

export function randomCode(digits = 6) {
  const min = 10 ** (digits - 1);
  const max = (10 ** digits) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}
