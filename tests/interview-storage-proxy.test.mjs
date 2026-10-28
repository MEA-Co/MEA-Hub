import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import ts from 'typescript';

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const helper = moduleUrl(
  await readFile(
    new URL('../lib/server/interview-proxy.ts', import.meta.url),
    'utf8',
  ),
);
const source = (
  await readFile(
    new URL('../lib/server/interview-storage-proxy.ts', import.meta.url),
    'utf8',
  )
).replace("from './interview-proxy'", `from '${helper}'`);
const { proxyActivityStorage } = await import(moduleUrl(source));
const originalFetch = globalThis.fetch;
const originalUrl = process.env.CORE_API_URL;
const token = 'a'.repeat(43);
const saved = {
  available: true,
  activities: [],
  updated_at: '2026-10-27T00:00:00Z',
  revision: 1,
};

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.CORE_API_URL;
  else process.env.CORE_API_URL = originalUrl;
});

function request(method = 'GET', cookie = '', body = undefined, extra = {}) {
  process.env.CORE_API_URL = 'http://core.test';
  return new Request('http://hub.test/api/interview/activities', {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extra,
    },
    body,
  });
}

test('unconfigured storage returns unavailable without issuing an identity cookie', async () => {
  globalThis.fetch = async () =>
    Response.json({
      available: false,
      activities: null,
      updated_at: null,
      revision: 0,
    });
  const response = await proxyActivityStorage(request());
  assert.equal((await response.json()).available, false);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('new browser gets HttpOnly scoped cookie; token does not appear in JSON', async () => {
  let owner;
  globalThis.fetch = async (_url, options) => {
    owner = options.headers['X-Interview-Owner'];
    return Response.json(saved);
  };
  const response = await proxyActivityStorage(request());
  assert.match(owner, /^[A-Za-z0-9_-]{43}$/);
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie.includes(owner));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/interview\/activities/);
  assert.doesNotMatch(await response.text(), new RegExp(owner));
});

test('separate browser cookies are independently generated', async () => {
  const owners = [];
  globalThis.fetch = async (_url, options) => {
    owners.push(options.headers['X-Interview-Owner']);
    return Response.json(saved);
  };
  await proxyActivityStorage(request());
  await proxyActivityStorage(request());
  assert.notEqual(owners[0], owners[1]);
});

test('existing browser identity is reused and raw browser cookies are not forwarded', async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers['X-Interview-Owner'], token);
    assert.equal(options.headers.Cookie, undefined);
    return Response.json({
      ...saved,
      owner_token: 'never_return',
      debug: 'never_return',
    });
  };
  const response = await proxyActivityStorage(
    request('GET', `unrelated=private; mea_interview_owner=${token}`),
  );
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(await response.json(), saved);
});

test('PUT requires established cookie and does not mint an inaccessible owner', async () => {
  globalThis.fetch = async () => {
    throw new Error('must not fetch');
  };
  assert.equal(
    (await proxyActivityStorage(request('PUT', '', '{}'))).status,
    409,
  );
});

test('PUT forwards exact bounded JSON and existing owner', async () => {
  const data = JSON.stringify({ activities: [], consent: true, revision: 0 });
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['X-Interview-Owner'], token);
    assert.equal(new TextDecoder().decode(options.body), data);
    return Response.json(saved);
  };
  const response = await proxyActivityStorage(
    request('PUT', `mea_interview_owner=${token}`, data),
  );
  assert.deepEqual(await response.json(), saved);
});

test('revision conflict gives recovery advice without exposing provider body', async () => {
  globalThis.fetch = async () =>
    new Response('PRIVATE_STUDENT_TEXT', { status: 409 });
  const response = await proxyActivityStorage(
    request('PUT', `mea_interview_owner=${token}`, '{}'),
  );
  assert.equal(response.status, 409);
  const text = await response.text();
  assert.match(text, /최신 저장본/);
  assert.doesNotMatch(text, /PRIVATE_STUDENT_TEXT/);
});

test('validation and DB errors never echo private inputs or database URLs', async () => {
  for (const status of [422, 500]) {
    globalThis.fetch = async () =>
      new Response('postgres://SECRET_STUDENT_DATA', { status });
    const response = await proxyActivityStorage(
      request('PUT', `mea_interview_owner=${token}`, '{}'),
    );
    assert.doesNotMatch(await response.text(), /SECRET_STUDENT_DATA|postgres/);
  }
});

test('rejects file payloads, oversized content and invalid JSON before forwarding', async () => {
  globalThis.fetch = async () => {
    throw new Error('must not fetch');
  };
  assert.equal(
    (
      await proxyActivityStorage(
        request('PUT', `mea_interview_owner=${token}`, 'PDF', {
          'Content-Type': 'application/pdf',
        }),
      )
    ).status,
    415,
  );
  assert.equal(
    (
      await proxyActivityStorage(
        request('PUT', `mea_interview_owner=${token}`, '['),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await proxyActivityStorage(
        request(
          'PUT',
          `mea_interview_owner=${token}`,
          'x'.repeat(512 * 1024 + 1),
        ),
      )
    ).status,
    413,
  );
});

test('cross-origin requests cannot read or save browser drafts', async () => {
  globalThis.fetch = async () => {
    throw new Error('must not fetch');
  };
  assert.equal(
    (
      await proxyActivityStorage(
        request('GET', '', undefined, { Origin: 'https://other.test' }),
      )
    ).status,
    403,
  );
});

test('sets Secure cookie behind an HTTPS reverse proxy', async () => {
  globalThis.fetch = async () => Response.json(saved);
  const response = await proxyActivityStorage(
    request('GET', '', undefined, { 'X-Forwarded-Proto': 'https' }),
  );
  assert.match(response.headers.get('set-cookie'), /; Secure/);
});

test('malformed upstream result or unreachable DB never discards browser input', async () => {
  globalThis.fetch = async () => Response.json({ broken: true });
  assert.equal((await proxyActivityStorage(request())).status, 502);
  globalThis.fetch = async () => {
    throw new Error('DB_PASSWORD');
  };
  const response = await proxyActivityStorage(request());
  assert.equal(response.status, 503);
  assert.match(await response.text(), /입력은 유지/);
});
