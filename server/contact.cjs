const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { isIP } = require('node:net');
const services = require('../src/data/services.json');

const MAX_BYTES = 32 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const ALLOWED_FIELDS = new Set(['name', 'email', 'services', 'birth', 'msg', 'website']);

class ContactError extends Error {
  constructor(status, code, message, diagnostic) { super(message); this.status = status; this.code = code; this.diagnostic = diagnostic; }
}
const invalid = message => new ContactError(400, 'INVALID_DATA', message);

// Only predefined Google error identifiers may enter logs. Never log responses,
// error descriptions, tokens, scopes, addresses, request bodies or raw exceptions.
const GOOGLE_REASONS = new Set([
  'invalid_grant', 'invalid_client', 'unauthorized_client', 'invalid_scope', 'access_denied',
  'accessNotConfigured', 'SERVICE_DISABLED', 'API_DISABLED', 'CONSUMER_INVALID',
  'ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'insufficientPermissions', 'authError', 'domainPolicy',
  'forbidden', 'PERMISSION_DENIED', 'UNAUTHENTICATED', 'badRequest', 'failedPrecondition',
  'rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded',
]);
function googleReason(data) {
  const error = data?.error;
  const candidates = [
    typeof error === 'string' ? error : undefined,
    ...(Array.isArray(error?.errors) ? error.errors.map(item => item?.reason) : []),
    ...(Array.isArray(error?.details) ? error.details.map(item => item?.reason) : []),
    error?.status,
  ];
  return candidates.find(reason => GOOGLE_REASONS.has(reason)) || 'unclassified';
}

function singleEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || /[\s\r\n]/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-z\d.!#$%&'*+\-/=?^_`{|}~]+$/i.test(local)) return false;
  return domain.includes('.') && domain.length <= 253 && domain.split('.').every(label =>
    label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label));
}

function validate(body, now) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Prześlij poprawne dane formularza.');
  if (Object.keys(body).some(key => !ALLOWED_FIELDS.has(key))) throw invalid('Formularz zawiera niedozwolone pola.');
  const text = (key, max, required = false, multiline = false) => {
    const value = body[key] === undefined ? '' : body[key];
    if (typeof value !== 'string' || value.length > max || (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(value)) {
      throw invalid('Sprawdź format i długość pól formularza.');
    }
    const trimmed = value.trim();
    if (required && !trimmed) throw invalid('Podaj imię i nazwisko oraz poprawny adres e-mail.');
    return trimmed;
  };
  const name = text('name', 120, true);
  const email = text('email', 200, true);
  if (!singleEmail(email)) throw invalid('Podaj pojedynczy, poprawny adres e-mail.');
  const birth = text('birth', 10);
  const msg = text('msg', 5000, false, true).replace(/\r\n?/g, '\n');
  if (text('website', 200)) throw invalid('Nie udało się przyjąć zgłoszenia.');
  const selected = body.services === undefined ? [] : body.services;
  if (!Array.isArray(selected) || selected.length > services.length || selected.some(service => typeof service !== 'string' || !services.includes(service)) || new Set(selected).size !== selected.length) {
    throw invalid('Wybierz usługi dostępne w formularzu.');
  }
  if (birth) {
    const date = new Date(birth + 'T00:00:00Z');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || Number(birth.slice(0, 4)) < 1000 || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== birth || birth > today) {
      throw invalid('Podaj poprawną datę urodzenia, nie późniejszą niż dzisiaj.');
    }
  }
  return { name, email, birth, msg, services: selected };
}

async function readBody(request) {
  const length = request.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(String(length)) || Number(length) > MAX_BYTES)) {
    throw new ContactError(413, 'BODY_TOO_LARGE', 'Zgłoszenie jest zbyt duże. Skróć wiadomość.');
  }
  let body = request.body;
  if (body === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BYTES) throw new ContactError(413, 'BODY_TOO_LARGE', 'Zgłoszenie jest zbyt duże. Skróć wiadomość.');
      chunks.push(buffer);
    }
    body = Buffer.concat(chunks);
  }
  const raw = Buffer.isBuffer(body) ? body.toString('utf8') : typeof body === 'string' ? body : JSON.stringify(body);
  if (Buffer.byteLength(raw || '', 'utf8') > MAX_BYTES) throw new ContactError(413, 'BODY_TOO_LARGE', 'Zgłoszenie jest zbyt duże. Skróć wiadomość.');
  try { return JSON.parse(raw); } catch { throw invalid('Nieprawidłowy format zgłoszenia.'); }
}

function allowedOrigin(origin, env) {
  if (typeof origin !== 'string') return false;
  const allowed = new Set(['https://www.kaneel.pl', 'https://kaneel.pl', 'https://kaneel.vercel.app']);
  if (env.VERCEL_ENV === 'preview' && /^[a-z\d.-]+\.vercel\.app$/i.test(env.VERCEL_URL || '')) allowed.add('https://' + env.VERCEL_URL);
  if (allowed.has(origin)) return true;
  if (!env.VERCEL && env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      return url.origin === origin && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
    } catch { return false; }
  }
  return false;
}

function configuration(env) {
  const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GMAIL_SENDER_EMAIL', 'CONTACT_TO_EMAIL'];
  if (keys.some(key => typeof env[key] !== 'string' || !env[key].trim()) || !singleEmail(env.GMAIL_SENDER_EMAIL) || !singleEmail(env.CONTACT_TO_EMAIL)) {
    throw new ContactError(503, 'NOT_CONFIGURED', 'Formularz jest chwilowo niedostępny. Napisz bezpośrednio na kaneelsky@gmail.com.');
  }
  return Object.fromEntries(keys.map(key => [key, env[key]]));
}

function mimeMessage(data, config, now) {
  const body = [
    'Nowe zgłoszenie z formularza Kaneel', '',
    `Imię i nazwisko: ${data.name}`, `E-mail: ${data.email}`,
    `Wybrane usługi: ${data.services.join('; ') || 'Nie wybrano'}`,
    `Data urodzenia: ${data.birth || 'Nie podano'}`, '',
    'Wiadomość:', data.msg || 'Nie podano treści wiadomości.',
  ].join('\r\n');
  const content = Buffer.from(body, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
  const encodedSubject = Buffer.from('Nowe zgłoszenie z formularza Kaneel', 'utf8').toString('base64');
  return [
    `From: ${config.GMAIL_SENDER_EMAIL}`, `To: ${config.CONTACT_TO_EMAIL}`,
    `Reply-To: ${data.email}`, `Subject: =?UTF-8?B?${encodedSubject}?=`,
    `Date: ${new Date(now).toUTCString()}`, `Message-ID: <${randomUUID()}@kaneel.pl>`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '', content, '',
  ].join('\r\n');
}

function createContactHandler({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now, logger = event => console.error(JSON.stringify(event)), googleTimeoutMs = 8000 } = {}) {
  // Best effort per warm instance only. A durable global rate limit belongs in Vercel Firewall.
  // Keys are salted hashes; raw IPs, form contents and credentials are never logged.
  const attempts = new Map();
  const salt = randomBytes(32);
  function limit(request) {
    const time = now();
    for (const [key, entry] of attempts) if (entry.expires <= time) attempts.delete(key);
    const forwarded = env.VERCEL ? request.headers['x-forwarded-for'] : undefined;
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.socket?.remoteAddress;
    const key = createHash('sha256').update(salt).update(isIP(ip || '') ? ip : 'unknown').digest('hex');
    const entry = attempts.get(key) || { count: 0, expires: time + WINDOW_MS };
    if (entry.count >= MAX_ATTEMPTS || (!attempts.has(key) && attempts.size >= 1024)) {
      const error = new ContactError(429, 'RATE_LIMITED', 'Zbyt wiele prób. Spróbuj ponownie za kilka minut.');
      error.retryAfter = Math.max(1, Math.ceil((entry.expires - time) / 1000));
      throw error;
    }
    entry.count++;
    if (!attempts.has(key)) {
      const cleanup = setTimeout(() => { if (attempts.get(key) === entry) attempts.delete(key); }, WINDOW_MS);
      cleanup.unref?.();
    }
    attempts.set(key, entry);
  }
  async function google(url, options, stage) {
    let upstreamStatus;
    let reason;
    try {
      const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(googleTimeoutMs), redirect: 'error' });
      upstreamStatus = response.status;
      // Keep the timeout active until the response body is read as well.
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        reason = googleReason(data);
        const reasons = Array.isArray(data?.error?.errors) ? data.error.errors.map(item => item?.reason) : [];
        if (response.status === 429 || reasons.some(reason => ['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded'].includes(reason))) {
          throw new ContactError(429, 'GOOGLE_LIMIT', 'Usługa pocztowa osiągnęła limit. Spróbuj ponownie później.');
        }
        if (stage === 'authorization' || [401, 403].includes(response.status)) {
          throw new ContactError(503, 'GOOGLE_AUTH', 'Wysyłka jest chwilowo niedostępna. Napisz bezpośrednio na kaneelsky@gmail.com.');
        }
        if (stage === 'send' && response.status >= 500) {
          throw new ContactError(502, 'DELIVERY_UNKNOWN', 'Nie udało się potwierdzić wysłania. Wiadomość mogła zostać przyjęta. Nie ponawiaj zgłoszenia od razu; w razie potrzeby napisz na kaneelsky@gmail.com.');
        }
        throw new ContactError(502, 'GOOGLE_ERROR', 'Usługa pocztowa odrzuciła zgłoszenie. Dane pozostały w formularzu. Spróbuj później.');
      }
      return data;
    } catch (error) {
      const diagnostic = { stage, ...(upstreamStatus ? { upstreamStatus } : {}), reason: reason || (['AbortError', 'TimeoutError'].includes(error?.name) ? 'timeout' : 'connection_error') };
      if (error instanceof ContactError) { error.diagnostic = diagnostic; throw error; }
      if (stage === 'send') throw new ContactError(504, 'DELIVERY_UNKNOWN', 'Nie udało się potwierdzić wysłania. Wiadomość mogła zostać przyjęta. Nie ponawiaj zgłoszenia od razu; w razie potrzeby napisz na kaneelsky@gmail.com.', diagnostic);
      throw new ContactError(504, 'GOOGLE_TIMEOUT', 'Nie można teraz połączyć się z usługą pocztową. Dane pozostały w formularzu. Spróbuj później.', diagnostic);
    }
  }
  return async function handler(request, response) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        throw new ContactError(405, 'METHOD_NOT_ALLOWED', 'Użyj formularza kontaktowego.');
      }
      if (!allowedOrigin(request.headers.origin, env)) throw new ContactError(403, 'ORIGIN_NOT_ALLOWED', 'Wyślij zgłoszenie z formularza na stronie Kaneel.');
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '') || !['identity', undefined].includes(request.headers['content-encoding'])) {
        throw new ContactError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Formularz wymaga danych w formacie JSON.');
      }
      limit(request);
      const data = validate(await readBody(request), now());
      const config = configuration(env);
      const token = await google('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: config.GOOGLE_CLIENT_ID, client_secret: config.GOOGLE_CLIENT_SECRET, refresh_token: config.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token', scope: GMAIL_SCOPE }),
      }, 'authorization');
      if (typeof token?.access_token !== 'string' || !token.access_token) {
        throw new ContactError(503, 'GOOGLE_AUTH', 'Wysyłka jest chwilowo niedostępna. Napisz bezpośrednio na kaneelsky@gmail.com.', { stage: 'authorization', reason: 'missing_access_token' });
      }
      if (token.scope !== undefined && (typeof token.scope !== 'string' || token.scope.split(/\s+/).some(scope => scope !== GMAIL_SCOPE))) {
        throw new ContactError(503, 'GOOGLE_AUTH', 'Wysyłka jest chwilowo niedostępna. Napisz bezpośrednio na kaneelsky@gmail.com.', { stage: 'authorization', reason: 'scope_not_send_only' });
      }
      const sent = await google('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: Buffer.from(mimeMessage(data, config, now()), 'utf8').toString('base64url') }),
      }, 'send');
      if (typeof sent?.id !== 'string' || !sent.id) {
        throw new ContactError(502, 'DELIVERY_UNKNOWN', 'Nie udało się potwierdzić wysłania. Nie ponawiaj zgłoszenia od razu; w razie potrzeby napisz na kaneelsky@gmail.com.');
      }
      response.statusCode = 200;
      response.end(JSON.stringify({ ok: true, message: 'Wiadomość została przyjęta do wysyłki. Dziękuję za kontakt.' }));
    } catch (error) {
      const safe = error instanceof ContactError ? error : new ContactError(500, 'INTERNAL_ERROR', 'Wystąpił błąd formularza. Dane pozostały w formularzu. Spróbuj później.');
      if (safe.status >= 500 || safe.code === 'GOOGLE_LIMIT') logger({ event: 'contact_error', code: safe.code, status: safe.status, ...safe.diagnostic });
      if (safe.status === 429) response.setHeader('Retry-After', String(safe.retryAfter || 60));
      response.statusCode = safe.status;
      response.end(JSON.stringify({ ok: false, code: safe.code, message: safe.message }));
    }
  };
}

module.exports = { createContactHandler };
