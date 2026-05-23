import express from 'express';
import nodemailer from 'nodemailer';
import { createSignedToken, verifySignedToken, parseCookies, setCookie, clearCookie } from '../services/authTokens.js';
import { createUser, findUserById, findUserByLogin, hashPassword, randomCode, sanitizeUser, updateUser, verifyPassword } from '../services/userStore.js';

const router = express.Router();
const SESSION_COOKIE = 'vt_session';
const PENDING_COOKIE = 'vt_pending';
const secureCookies = process.env.NODE_ENV === 'production' && String(process.env.SITE_URL || '').startsWith('https://');

function createCaptcha() {
  const a = Math.floor(2 + Math.random() * 11);
  const b = Math.floor(2 + Math.random() * 11);
  const answer = String(a + b);
  const token = createSignedToken({ answer, exp: Date.now() + 10 * 60 * 1000 });
  return { a, b, token, question: `${a} + ${b} = ?` };
}

function verifyCaptcha(token, answer) {
  const payload = verifySignedToken(token);
  return Boolean(payload && String(payload.answer) === String(answer).trim());
}

function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 10 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

function setSession(res, userId) {
  const token = createSignedToken({ uid: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  setCookie(res, SESSION_COOKIE, token, { maxAge: 7 * 24 * 60 * 60, secure: secureCookies });
}

function setPending(res, userId) {
  const token = createSignedToken({ uid: userId, exp: Date.now() + 30 * 60 * 1000 });
  setCookie(res, PENDING_COOKIE, token, { maxAge: 30 * 60, secure: secureCookies });
}

export function getAuthenticatedUser(req) {
  const cookies = parseCookies(req);
  const payload = verifySignedToken(cookies[SESSION_COOKIE]);
  if (!payload?.uid) return null;
  const user = findUserById(payload.uid);
  if (!user || !user.email_verified_at) return null;
  return user;
}

async function sendVerificationEmail(to, code, username) {
  const from = process.env.MAIL_FROM || 'no-reply@yourdomain.com';
  const fromName = process.env.MAIL_FROM_NAME || process.env.SITE_NAME || 'Vixtreet';
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log(`[EMAIL DEBUG] Verification code for ${username} <${to}>: ${code}`);
    return { ok: true, mode: 'console' };
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined
  });
  await transporter.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    subject: `${fromName} email verification code`,
    text: `Hello ${username},\n\nYour verification code is ${code}. It expires in 20 minutes.`,
    html: `<p>Hello ${username},</p><p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 20 minutes.</p>`
  });
  return { ok: true, mode: 'smtp' };
}

router.get('/captcha', (req, res) => res.json({ ok: true, captcha: createCaptcha() }));

router.get('/me', (req, res) => {
  const user = getAuthenticatedUser(req);
  res.json({ ok: true, authenticated: Boolean(user), user: sanitizeUser(user) });
});

router.post('/login', async (req, res) => {
  const { login, password, captchaToken, captchaAnswer } = req.body || {};
  if (!verifyCaptcha(captchaToken, captchaAnswer)) return res.status(400).json({ ok: false, error: 'Human verification failed. Refresh captcha and try again.' });
  const user = findUserByLogin(login);
  if (!user || !(await verifyPassword(password, user.password_hash))) return res.status(401).json({ ok: false, error: 'Invalid username/email or password.' });
  if (!user.email_verified_at) {
    setPending(res, user.id);
    return res.status(403).json({ ok: false, needsVerification: true, error: 'Email verification required before dashboard access.' });
  }
  setSession(res, user.id);
  clearCookie(res, PENDING_COOKIE);
  res.json({ ok: true, user: sanitizeUser(user) });
});

router.post('/signup', async (req, res) => {
  const { username, email, mobile, password, confirmPassword, captchaToken, captchaAnswer } = req.body || {};
  if (!verifyCaptcha(captchaToken, captchaAnswer)) return res.status(400).json({ ok: false, error: 'Human verification failed. Refresh captcha and try again.' });
  if (!/^[A-Za-z0-9_]{3,32}$/.test(String(username || ''))) return res.status(400).json({ ok: false, error: 'Username must be 3-32 characters and use only letters, numbers, and underscore.' });
  if (!/^\S+@\S+\.\S+$/.test(String(email || ''))) return res.status(400).json({ ok: false, error: 'Enter a valid email address.' });
  if (!String(mobile || '').trim()) return res.status(400).json({ ok: false, error: 'Mobile / WhatsApp number is required.' });
  if (password !== confirmPassword) return res.status(400).json({ ok: false, error: 'Passwords do not match.' });
  if (!validPassword(password)) return res.status(400).json({ ok: false, error: 'Password must be 10+ characters with uppercase, lowercase, number and symbol.' });
  const code = randomCode();
  const result = createUser({ username, email, mobile, password_hash: await hashPassword(password), email_verification_code: code, email_code_expires: Math.floor(Date.now() / 1000) + 1200 });
  if (!result.ok) return res.status(409).json(result);
  await sendVerificationEmail(result.user.email, code, result.user.username);
  setPending(res, result.user.id);
  const debug = String(process.env.APP_DEBUG_VERIFICATION || 'false') === 'true';
  res.json({ ok: true, needsVerification: true, user: sanitizeUser(result.user), debugCode: debug ? code : undefined });
});

router.post('/verify-email', (req, res) => {
  const cookies = parseCookies(req);
  const pending = verifySignedToken(cookies[PENDING_COOKIE]);
  const user = pending?.uid ? findUserById(pending.uid) : null;
  if (!user) return res.status(401).json({ ok: false, error: 'Verification session expired. Please sign up or login again.' });
  const code = String(req.body?.code || '').trim();
  if (!/^[0-9]{6}$/.test(code)) return res.status(400).json({ ok: false, error: 'Enter the 6-digit verification code.' });
  if (Number(user.email_code_expires || 0) < Math.floor(Date.now() / 1000)) return res.status(400).json({ ok: false, error: 'Verification code expired. Click resend code.' });
  if (String(user.email_verification_code) !== code) return res.status(400).json({ ok: false, error: 'Incorrect verification code.' });
  const updated = updateUser(user.id, { email_verified_at: Math.floor(Date.now() / 1000), email_verification_code: null, email_code_expires: null });
  setSession(res, user.id);
  clearCookie(res, PENDING_COOKIE);
  res.json({ ok: true, user: sanitizeUser(updated) });
});

router.post('/resend-code', async (req, res) => {
  const cookies = parseCookies(req);
  const pending = verifySignedToken(cookies[PENDING_COOKIE]);
  const user = pending?.uid ? findUserById(pending.uid) : null;
  if (!user) return res.status(401).json({ ok: false, error: 'Verification session expired.' });
  const code = randomCode();
  updateUser(user.id, { email_verification_code: code, email_code_expires: Math.floor(Date.now() / 1000) + 1200 });
  await sendVerificationEmail(user.email, code, user.username);
  const debug = String(process.env.APP_DEBUG_VERIFICATION || 'false') === 'true';
  res.json({ ok: true, debugCode: debug ? code : undefined });
});

router.post('/logout', (req, res) => {
  clearCookie(res, SESSION_COOKIE);
  clearCookie(res, PENDING_COOKIE);
  res.json({ ok: true });
});

export default router;
