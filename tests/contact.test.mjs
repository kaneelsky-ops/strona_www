import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createContactHandler } = require('../server/contact.cjs');
const services = require('../src/data/services.json');

// Deliberately fake credentials. Every Google request is intercepted by fetchImpl.
const env = {
  NODE_ENV: 'production', VERCEL: '1',
  GOOGLE_CLIENT_ID: 'fake-client-id', GOOGLE_CLIENT_SECRET: 'fake-client-secret',
  GOOGLE_REFRESH_TOKEN: 'fake-refresh-token',
  GMAIL_SENDER_EMAIL: 'sender@example.com', CONTACT_TO_EMAIL: 'owner@example.com',
};
const valid = () => ({ name: 'Żaneta Łucja', email: 'visitor@example.net', services: [services[0], services[4]], birth: '1990-05-12', msg: 'Proszę o analizę.\nPytanie o relacje & pracę.', website: '' });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(replies = [() => json({ access_token: 'fake-access-token', scope: 'https://www.googleapis.com/auth/gmail.send' }), () => json({ id: 'fake-message-id' })], overrides = {}) {
  const calls = [], logs = [];
  const handler = createContactHandler({
    env, logger: entry => logs.push(entry), now: () => Date.UTC(2026, 9, 30, 12),
    fetchImpl: async (url, options) => {
      assert.ok(['https://oauth2.googleapis.com/token', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'].includes(url));
      calls.push({ url, options });
      const reply = replies[calls.length - 1];
      assert.ok(reply, 'Unexpected duplicate Google request');
      return reply(options);
    },
    ...overrides,
  });
  return { handler, calls, logs };
}
async function invoke(handler, body = valid(), options = {}) {
  const headers = { origin: 'https://www.kaneel.pl', 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.10', ...options.headers };
  const request = options.stream ? Readable.from(options.stream) : {};
  Object.assign(request, { method: options.method || 'POST', headers, socket: { remoteAddress: '127.0.0.1' } });
  if (!options.stream) request.body = body;
  const response = { headers: {}, ended: false, setHeader(key, value) { this.headers[key.toLowerCase()] = value; }, end(value) { this.ended = true; this.body = JSON.parse(value); } };
  await handler(request, response);
  return response;
}

test('All fields are delivered as UTF-8 MIME, with a fixed recipient, sender and verified Reply-To', async () => {
  const { handler, calls } = setup();
  const response = await invoke(handler);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /oauth2.googleapis.com\/token$/);
  const tokenBody = calls[0].options.body;
  assert.equal(tokenBody.get('grant_type'), 'refresh_token');
  assert.equal(tokenBody.get('refresh_token'), env.GOOGLE_REFRESH_TOKEN);
  assert.equal(tokenBody.get('scope'), 'https://www.googleapis.com/auth/gmail.send');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer fake-access-token');
  assert.match(calls[1].url, /users\/me\/messages\/send$/);
  const { raw } = JSON.parse(calls[1].options.body);
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  const mime = Buffer.from(raw, 'base64url').toString('utf8');
  const [headers, encodedBody] = mime.split('\r\n\r\n');
  assert.match(headers, /^From: sender@example.com\r\nTo: owner@example.com\r\nReply-To: visitor@example.net/m);
  assert.doesNotMatch(headers, /^(?:Cc|Bcc):/im);
  const subject = headers.match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/)[1];
  assert.equal(Buffer.from(subject, 'base64').toString('utf8'), 'Nowe zgłoszenie z formularza Kaneel');
  const text = Buffer.from(encodedBody, 'base64').toString('utf8');
  for (const value of ['Żaneta Łucja', 'visitor@example.net', services[0], services[4], '1990-05-12', 'Pytanie o relacje & pracę.']) assert.ok(text.includes(value), value);
  assert.doesNotMatch(JSON.stringify(response.body), /fake-access|fake-refresh|fake-client/);
});

test('Only existing required fields are required; services, date and message may be omitted', async () => {
  const { handler } = setup();
  const response = await invoke(handler, { name: 'Anna', email: 'anna@example.com' });
  assert.equal(response.statusCode, 200);
});

test('Invalid types, text lengths, addresses, dates, service choices and honeypots are rejected before Google', async () => {
  const cases = [null, [], 'not JSON', { name: '', email: 'x@y.pl' },
    { ...valid(), name: ['Anna'] }, { ...valid(), name: 'a'.repeat(121) },
    { ...valid(), email: 'a@example.com,b@example.com' },
    { ...valid(), email: 'Name <a@example.com>' }, { ...valid(), email: 'a..b@example.com' },
    { ...valid(), email: 'a@example.com\r\nBcc: attacker@example.com' },
    { ...valid(), name: 'Anna\r\nBcc: attacker@example.com' },
    { ...valid(), msg: 'x'.repeat(5001) }, { ...valid(), msg: '\u0000' },
    { ...valid(), birth: '2025-02-29' }, { ...valid(), birth: '2099-01-01' }, { ...valid(), birth: 1990 },
    { ...valid(), services: services[0] }, { ...valid(), services: ['unknown'] },
    { ...valid(), services: [services[0], services[0]] }, { ...valid(), website: 'spam.example' },
  ];
  for (const body of cases) {
    const { handler, calls } = setup(); const response = await invoke(handler, body);
    assert.equal(response.statusCode, 400, JSON.stringify(body));
    assert.equal(response.body.ok, false); assert.equal(calls.length, 0);
  }
});

test('A client cannot change To, From, Reply-To, CC or BCC', async () => {
  for (const key of ['to', 'recipient', 'from', 'replyTo', 'cc', 'bcc', 'headers']) {
    const { handler, calls } = setup();
    const response = await invoke(handler, { ...valid(), [key]: 'attacker@example.com' });
    assert.equal(response.statusCode, 400); assert.equal(calls.length, 0);
  }
});

test('Foreign, missing, null and spoofed host origins are blocked; only POST JSON is accepted', async () => {
  for (const origin of ['https://evil.example', 'https://www.kaneel.pl.evil.example', 'https://www.kaneel.pl/path', 'null', undefined]) {
    const { handler, calls } = setup();const response = await invoke(handler, valid(), { headers: { origin } });
    assert.equal(response.statusCode, 403); assert.equal(calls.length, 0);
  }
  for (const method of ['GET', 'OPTIONS', 'PUT']) {
    const response = await invoke(setup().handler, valid(), { method });
    assert.equal(response.statusCode, 405);assert.equal(response.headers.allow, 'POST');
  }
  assert.equal((await invoke(setup().handler, valid(), { headers: { 'content-type': 'text/plain' } })).statusCode, 415);
  assert.equal((await invoke(setup().handler, valid(), { headers: { 'content-encoding': 'gzip' } })).statusCode, 415);
});

test('Vercel preview accepts only the current configured preview origin', async () => {
  const currentEnv = { ...env, VERCEL_ENV: 'preview', VERCEL_URL: 'kaneel-test-example.vercel.app' };
  assert.equal((await invoke(setup(undefined, { env: currentEnv }).handler, valid(), { headers: { origin: 'https://kaneel-test-example.vercel.app' } })).statusCode, 200);
  assert.equal((await invoke(setup(undefined, { env: currentEnv }).handler, valid(), { headers: { origin: 'https://other.vercel.app' } })).statusCode, 403);
});

test('Oversized raw, parsed, streamed and Content-Length requests are rejected', async () => {
  for (const options of [{ headers: { 'content-length': '40000' } }, { stream: [Buffer.alloc(33000)] }]) {
    const { handler, calls } = setup();const response = await invoke(handler, valid(), options);
    assert.equal(response.statusCode, 413);assert.equal(calls.length, 0);
  }
  assert.equal((await invoke(setup().handler, { ...valid(), msg: 'a'.repeat(33000) })).statusCode, 413);
  assert.equal((await invoke(setup().handler, '{')).statusCode, 400);
  const serialized = JSON.stringify(valid());
  assert.equal((await invoke(setup().handler, undefined, { stream: [serialized.slice(0, 10), serialized.slice(10)] })).statusCode, 200);
});

test('Missing or unsafe server configuration is safe and causes no Google requests', async () => {
  for (const config of [{}, { ...env, GOOGLE_REFRESH_TOKEN: '' }, { ...env, CONTACT_TO_EMAIL: 'x@y.com\r\nBcc: evil@example.com' }]) {
    const { handler, calls, logs } = setup(undefined, { env: config });const response = await invoke(handler);
    assert.equal(response.statusCode, 503);assert.equal(response.body.code, 'NOT_CONFIGURED');assert.equal(calls.length, 0);
    assert.deepEqual(logs, [{ event: 'contact_error', code: 'NOT_CONFIGURED', status: 503 }]);
  }
});

test('Revoked refresh token or malformed OAuth response never reaches Gmail send', async () => {
  for (const reply of [() => json({ error: 'invalid_grant' }, 400), () => json({}), () => json({ access_token: 'x', scope: 'https://mail.google.com/' })]) {
    const { handler, calls } = setup([reply]);const response = await invoke(handler);
    assert.equal(response.statusCode, 503); assert.equal(response.body.ok, false);assert.equal(calls.length, 1);
  }
});

test('A Gmail rejection or missing message id never produces success and never retries the send', async () => {
  for (const [reply, expected] of [
    [() => json({ error: {} }, 401), 503], [() => json({ error: {} }, 403), 503],
    [() => json({ error: {} }, 400), 502], [() => json({ error: {} }, 500), 502],
    [() => json({}), 502],
  ]) {
    const { handler, calls } = setup([() => json({ access_token: 'fake-token' }), reply]);
    const response = await invoke(handler);assert.equal(response.statusCode, expected);assert.equal(response.body.ok, false);assert.equal(calls.length, 2);
  }
});

test('Google quota errors return 429 with a retry hint', async () => {
  for (const reply of [() => json({ error: {} }, 429), () => json({ error: { errors: [{ reason: 'dailyLimitExceeded' }] } }, 403)]) {
    const { handler, calls } = setup([() => json({ access_token: 'fake-token' }), reply]);
    const response = await invoke(handler);assert.equal(response.statusCode, 429);assert.equal(response.headers['retry-after'], '60');assert.equal(calls.length, 2);
  }
});

test('Network loss and a timed-out send have an uncertain outcome and never retry', async () => {
  for (const reject of [() => { throw new TypeError('network includes private details'); }, options => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }))]) {
    const { handler, calls, logs } = setup([() => json({ access_token: 'fake-token' }), reject], { googleTimeoutMs: 20 });
    // AbortSignal timers are unref'd by Node; this timer keeps the mocked wait alive.
    const keepAlive = setTimeout(() => {}, 1000);
    try {
      const response = await invoke(handler);assert.equal(response.statusCode, 504);assert.equal(response.body.code, 'DELIVERY_UNKNOWN');assert.equal(response.body.ok, false);assert.equal(calls.length, 2);
      assert.doesNotMatch(JSON.stringify({ response: response.body, logs }), /Żaneta|visitor@example|fake-token|network includes/);
    } finally { clearTimeout(keepAlive); }
  }
});

test('Per-instance attempt limit is enforced, expires after ten minutes and does not call Google when blocked', async () => {
  let time = Date.UTC(2026, 9, 30, 12);
  const handler = createContactHandler({ env, now: () => time, logger: () => {}, fetchImpl: () => { throw new Error('Must not reach Google'); } });
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await invoke(handler, {})).statusCode, 400);
  const blocked = await invoke(handler, {});assert.equal(blocked.statusCode, 429);assert.equal(blocked.headers['retry-after'], '600');
  time += 10 * 60 * 1000 + 1;assert.equal((await invoke(handler, {})).statusCode, 400);
});

test('Service whitelist matches the actual form, and Vercel keeps the endpoint outside the static output', () => {
  const html = fs.readFileSync(new URL('../src/pages/home.html', import.meta.url), 'utf8');
  const choices = [...html.matchAll(/name="services" value="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(choices, services);
  const vercel = require('../vercel.json');assert.equal(vercel.outputDirectory, 'public');assert.equal(vercel.framework, null);
  assert.equal(vercel.functions['api/contact.js'].maxDuration, 30);
  assert.equal(vercel.rewrites, undefined);assert.ok(fs.existsSync(new URL('../api/contact.js', import.meta.url)));
  assert.equal(fs.existsSync(new URL('../public/api/contact.js', import.meta.url)), false);
});
