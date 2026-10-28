import { randomBytes } from 'node:crypto';

import { boundedBody, coreBaseUrl, isSameOrigin } from './interview-proxy';

const COOKIE = 'mea_interview_owner';
const OWNER_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function failure(message: string, status: number) {
  return Response.json({ message }, { status, headers });
}

function ownerCookie(request: Request): string | null {
  const raw = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  const token = raw.slice(COOKIE.length + 1);
  return OWNER_PATTERN.test(token) ? token : null;
}

export async function proxyActivityStorage(
  request: Request,
): Promise<Response> {
  if (!isSameOrigin(request))
    return failure('이 페이지에서 다시 요청해주세요.', 403);
  const method = request.method;
  if (method !== 'GET' && method !== 'PUT')
    return failure('지원하지 않는 요청입니다.', 405);
  const existing = ownerCookie(request);
  if (method === 'PUT' && !existing)
    return failure(
      '저장 연결을 다시 확인해주세요. 페이지를 새로 열고 저장해주세요.',
      409,
    );
  let base: string;
  try {
    base = coreBaseUrl();
  } catch {
    return failure('활동 저장 서버 연결 설정이 필요합니다.', 503);
  }

  let body: Uint8Array | undefined;
  if (method === 'PUT') {
    if (
      !request.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('application/json')
    )
      return failure('정리한 활동 정보만 저장할 수 있습니다.', 415);
    try {
      body = await boundedBody(request, 512 * 1024);
      const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return failure('저장할 활동 형식을 확인해주세요.', 400);
    } catch (cause) {
      return failure(
        cause instanceof RangeError
          ? '저장할 활동이 너무 큽니다.'
          : '저장할 활동 형식을 확인해주세요.',
        cause instanceof RangeError ? 413 : 400,
      );
    }
  }

  const owner = existing || randomBytes(32).toString('base64url');
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  request.signal.addEventListener('abort', onAbort, { once: true });
  if (request.signal.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch(`${base}/api/interview/activities`, {
      method,
      headers: {
        Accept: 'application/json',
        'X-Interview-Owner': owner,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? new Uint8Array(body).buffer : undefined,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      if (upstream.status === 409)
        return failure(
          '다른 화면에서 저장된 내용이 있습니다. 현재 입력을 파일로 저장한 뒤 최신 저장본을 불러와주세요.',
          409,
        );
      if (upstream.status === 422 || upstream.status === 400)
        return failure(
          '저장할 활동의 형식과 길이를 확인해주세요. 생기부 원문·개인정보는 저장할 수 없습니다.',
          422,
        );
      if (upstream.status === 401 || upstream.status === 403)
        return failure(
          '저장 연결을 다시 확인해주세요. 현재 입력은 유지됩니다.',
          403,
        );
      return failure(
        '활동 저장 서비스를 사용할 수 없습니다. 현재 입력은 유지됩니다.',
        503,
      );
    }
    const value: unknown = await upstream.json();
    if (!value || typeof value !== 'object')
      return failure('저장 서버 응답을 확인할 수 없습니다.', 502);
    const result = value as Record<string, unknown>;
    if (
      typeof result.available !== 'boolean' ||
      (result.activities !== null && !Array.isArray(result.activities)) ||
      !Number.isInteger(result.revision) ||
      (result.revision as number) < 0 ||
      (result.updated_at !== null && typeof result.updated_at !== 'string')
    )
      return failure('저장 서버 응답을 확인할 수 없습니다.', 502);
    const response = Response.json(
      {
        available: result.available,
        activities: result.activities,
        updated_at: result.updated_at,
        revision: result.revision,
      },
      { headers },
    );
    if (result.available && !existing) {
      const secure =
        new URL(request.url).protocol === 'https:' ||
        request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ===
          'https';
      response.headers.set(
        'Set-Cookie',
        `${COOKIE}=${owner}; Path=/api/interview/activities; HttpOnly; SameSite=Strict; Max-Age=2592000${secure ? '; Secure' : ''}`,
      );
    }
    return response;
  } catch {
    return failure(
      '활동 저장 서버에 연결하지 못했습니다. 현재 입력은 유지됩니다.',
      503,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener('abort', onAbort);
  }
}
