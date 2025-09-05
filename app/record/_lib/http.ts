export type Year = '1학년' | '2학년' | '3학년';

export type ChangcheYear = {
  자율활동: string;
  동아리활동: string;
  희망분야: string;
  진로활동: string;
};

export type YearBundle = {
  창체: ChangcheYear;
  세특: Record<string, string>;
};

export type Activities = Record<Year, YearBundle>;

export type RecordOk = {
  ok: true;
  filename: string;
  chars: number;
  activities: Activities;
};

export type RecordErr = {
  ok: false;
  error: string;
  filename: string;
  chars: number;
};

export type RecordRes = RecordOk | RecordErr;

export function isRecordOk(res: RecordRes): res is RecordOk {
  return res.ok === true;
}

export const ERROR_MESSAGES: Record<string, string> = {
  invalid_file: '잘못된 파일입니다. 생활기록부를 업로드해주세요.',
  empty_file: '파일이 비어 있습니다.',
  no_text: 'PDF에서 텍스트를 추출하지 못했습니다.',
};

export class AppError extends Error {
  code?: string;
  status?: number;
  constructor(msg: string, opts?: { code?: string; status?: number }) {
    super(msg);
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

function getErrorCodeFromBody(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null) {
    const maybe = (body as Record<string, unknown>).error;
    if (typeof maybe === 'string') return maybe;
  }
  return `HTTP_${status}`;
}

function isAbortError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'name' in e &&
    (e as { name?: unknown }).name === 'AbortError'
  );
}

function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && typeof e.message === 'string') return e.message;
  return fallback;
}

export async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    init?.timeoutMs ?? 30000,
  );
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });

    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
      const code = getErrorCodeFromBody(body, res.status);
      const msg =
        ERROR_MESSAGES[code] ??
        (res.status === 413
          ? '파일이 너무 큽니다.'
          : '요청 처리 중 오류가 발생했습니다.');
      throw new AppError(msg, { code, status: res.status });
    }

    return (await res.json()) as T;
  } catch (err) {
    if (isAbortError(err)) {
      throw new AppError(
        '요청 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.',
        {
          code: 'timeout',
        },
      );
    }
    if (err instanceof AppError) throw err;
    throw new AppError(getErrorMessage(err, '네트워크 오류가 발생했습니다.'), {
      code: 'network_error',
    });
  } finally {
    clearTimeout(timeout);
  }
}
