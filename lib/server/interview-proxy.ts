import { isAgentCoreSpeechSessionUrl } from '../speech-session-url';

const MAX_JSON_BYTES = 512 * 1024;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 100_000;

const privateHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function error(message: string, status: number) {
  return Response.json({ message }, { status, headers: privateHeaders });
}

export function coreBaseUrl(): string {
  const configured =
    process.env.CORE_API_URL || process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
  const value =
    configured ||
    (process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:8000' : '');
  if (!value) throw new Error('Core URL is missing');
  const parsed = new URL(value);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error('Invalid Core URL');
  }
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export function speechWebSocketUrl(request: Request): string | null {
  try {
    const configured = process.env.INTERVIEW_SPEECH_WS_URL;
    const url = new URL(configured || `${coreBaseUrl()}/api/interview/speech`);
    if (!configured) url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    // This address is returned to browsers. Never put credentials in its URL.
    if (
      !['ws:', 'wss:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    const protocol =
      request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ||
      new URL(request.url).protocol.replace(':', '');
    if (protocol === 'https' && url.protocol !== 'wss:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function boundedBody(
  request: Request,
  maximum: number,
): Promise<Uint8Array> {
  if (Number(request.headers.get('content-length') || 0) > maximum)
    throw new RangeError('Body too large');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) {
        await reader.cancel();
        throw new RangeError('Body too large');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

// Validation errors can echo submitted student text; never relay their raw bodies.
function upstreamMessage(status: number, resource: string): string {
  if (resource === 'transcribe' && (status === 400 || status === 422))
    return '인식된 음성이 없거나 답변이 너무 깁니다. 다시 녹음하거나 채팅으로 답변해주세요.';
  if (status === 422 || status === 400)
    return '입력 내용을 확인해주세요. 정리한 활동 10개 이상과 면접 설정이 필요하며, 생기부 원문은 제출할 수 없습니다.';
  if (status === 413) return '입력한 내용이나 음성 파일이 너무 큽니다.';
  if (status === 415)
    return '지원하지 않는 음성 형식입니다. 채팅으로 답변해주세요.';
  if (status === 503)
    return '현재 면접 또는 음성 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
  if (status === 429) return '요청이 많습니다. 잠시 후 다시 시도해주세요.';
  return '면접 서버에서 요청을 처리하지 못했습니다. 입력 내용은 유지됩니다.';
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin) {
    // Next can rebuild request.url with its internal listener hostname.
    // Host is the destination selected by the browser, including reverse-proxy deployments.
    const internal = new URL(request.url);
    const host = request.headers.get('host') || internal.host;
    const forwardedProtocol = request.headers
      .get('x-forwarded-proto')
      ?.split(',')[0]
      .trim();
    const protocol =
      forwardedProtocol === 'https' || forwardedProtocol === 'http'
        ? `${forwardedProtocol}:`
        : internal.protocol;
    try {
      if (new URL(origin).origin !== new URL(`${protocol}//${host}`).origin)
        return false;
    } catch {
      return false;
    }
  }
  return true;
}

export async function proxyInterview(
  request: Request,
  resource: 'stream' | 'capabilities' | 'transcribe' | 'speech/session',
): Promise<Response> {
  if (!isSameOrigin(request))
    return error('이 페이지에서 다시 요청해주세요.', 403);
  let base: string;
  try {
    base = coreBaseUrl();
  } catch {
    return error('면접 서버 연결 설정이 필요합니다.', 503);
  }
  const isSpeechSession = resource === 'speech/session';
  let body: Uint8Array | undefined;
  const contentType = request.headers.get('content-type') || '';
  if (resource !== 'capabilities') {
    if (
      (resource === 'stream' || isSpeechSession) &&
      !contentType.toLowerCase().startsWith('application/json')
    )
      return error(
        '정리한 활동 정보만 입력할 수 있습니다. 원문 파일 업로드는 지원하지 않습니다.',
        415,
      );
    if (
      resource === 'transcribe' &&
      !contentType.toLowerCase().startsWith('multipart/form-data;')
    )
      return error('녹음된 음성을 확인해주세요.', 415);
    try {
      body = await boundedBody(
        request,
        isSpeechSession
          ? 1024
          : resource === 'stream'
            ? MAX_JSON_BYTES
            : MAX_AUDIO_BYTES + 8192,
      );
    } catch (reason) {
      return error(
        reason instanceof RangeError
          ? '입력한 내용이나 음성 파일이 너무 큽니다.'
          : '요청을 읽지 못했습니다.',
        reason instanceof RangeError ? 413 : 400,
      );
    }
    if (resource === 'stream' || isSpeechSession) {
      try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          Array.isArray(parsed) ||
          (isSpeechSession && Object.keys(parsed).length !== 0)
        )
          throw new Error();
      } catch {
        return error('입력 형식을 확인해주세요.', 400);
      }
    }
  }
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  request.signal.addEventListener('abort', onAbort, { once: true });
  if (request.signal.aborted) abort.abort();
  const timer = setTimeout(() => abort.abort(), UPSTREAM_TIMEOUT_MS);
  const cleanup = () => {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', onAbort);
  };
  try {
    const upstream = await fetch(`${base}/api/interview/${resource}`, {
      method: resource === 'capabilities' ? 'GET' : 'POST',
      headers: {
        Accept:
          resource === 'stream' ? 'text/event-stream' : 'application/json',
        ...(body ? { 'Content-Type': contentType } : {}),
        ...(isSpeechSession && request.headers.get('origin')
          ? { Origin: request.headers.get('origin') as string }
          : {}),
      },
      body: body ? new Uint8Array(body).buffer : undefined,
      signal: abort.signal,
      cache: 'no-store',
      redirect: 'error',
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      cleanup();
      return error(
        upstreamMessage(upstream.status, resource),
        upstream.status >= 500 ? 503 : upstream.status,
      );
    }
    if (resource !== 'stream') {
      let data: unknown = await upstream.json();
      if (isSpeechSession) {
        if (
          !data ||
          typeof data !== 'object' ||
          !('expires_in' in data) ||
          data.expires_in !== 60 ||
          !('websocket_url' in data) ||
          !isAgentCoreSpeechSessionUrl(data.websocket_url)
        ) {
          cleanup();
          return error(
            '실시간 음성 연결 정보를 확인하지 못했습니다. 다시 시도해주세요.',
            503,
          );
        }
        data = { websocket_url: data.websocket_url, expires_in: 60 };
      }

      if (
        resource === 'capabilities' &&
        data &&
        typeof data === 'object' &&
        'speech_streaming' in data &&
        data.speech_streaming === true
      ) {
        if ('speech_session' in data && data.speech_session === true) {
          // A fresh signed URL is obtained when recording starts, not while
          // preparing activities. Never replace it with a Lambda-derived WSS URL.
          data = { ...data, speech_websocket_url: undefined };
        } else {
          const websocketUrl = speechWebSocketUrl(request);
          data = {
            ...data,
            speech_streaming: Boolean(websocketUrl),
            speech_websocket_url: websocketUrl ?? undefined,
          };
        }
      }
      cleanup();
      return Response.json(data, { headers: privateHeaders });
    }
    if (
      !upstream.body ||
      !upstream.headers.get('content-type')?.includes('text/event-stream')
    ) {
      await upstream.body?.cancel();
      cleanup();
      return error('면접 서버의 응답 형식을 확인할 수 없습니다.', 502);
    }
    const reader = upstream.body.getReader();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (cancelled) return;
          if (done) {
            cleanup();
            controller.close();
          } else controller.enqueue(value);
        } catch {
          cleanup();
          if (cancelled) return;
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'error', message: '면접 서버 연결이 끊겼습니다. 입력 내용은 유지됩니다. 다시 시도해주세요.' })}\n\n`,
            ),
          );
          controller.close();
        }
      },
      async cancel() {
        cancelled = true;
        abort.abort();
        cleanup();
        await reader.cancel().catch(() => undefined);
      },
    });
    return new Response(stream, {
      headers: {
        ...privateHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    cleanup();
    return error(
      '면접 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.',
      503,
    );
  }
}
