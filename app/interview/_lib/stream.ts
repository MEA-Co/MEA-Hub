import type { InterviewRequest, StreamEvent } from './types';

function serverMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (typeof body.message === 'string') return body.message;
  if (typeof body.detail === 'string') return body.detail;
  if (typeof body.error === 'string') return body.error;
  return null;
}

export async function streamInterview(
  payload: InterviewRequest,
  signal: AbortSignal,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const response = await fetch('/api/interview/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(
      serverMessage(body) ??
        (response.status === 422
          ? '활동 정보와 면접 설정을 다시 확인해주세요.'
          : '면접에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'),
    );
  }
  if (
    !response.body ||
    !response.headers.get('content-type')?.includes('text/event-stream')
  )
    throw new Error('면접 응답을 읽을 수 없습니다. 연결 상태를 확인해주세요.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let complete = false;
  const consume = (frame: string) => {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return;
    let event: StreamEvent;
    try {
      event = JSON.parse(data) as StreamEvent;
    } catch {
      throw new Error('면접 응답을 읽지 못했습니다. 다시 요청해주세요.');
    }
    if (!event || typeof event !== 'object')
      throw new Error('면접 응답 형식이 올바르지 않습니다.');
    if (event.type === 'error')
      throw new Error(
        event.message || '질문을 준비하지 못했습니다. 다시 시도해주세요.',
      );
    if (event.type === 'question' || event.type === 'result') complete = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!complete)
      throw new Error(
        '연결이 중간에 끊겼습니다. 입력한 답변은 남아 있으니 다시 요청해주세요.',
      );
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
