import assert from 'node:assert/strict';
import test from 'node:test';

import { streamInterview } from './stream.ts';

const payload = {
  action: 'start',
  settings: {},
  activities: [],
  history: [],
  elapsed_seconds: 0,
  consent: true,
};

async function withResponse(response, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => response;
  try {
    await run();
  } finally {
    globalThis.fetch = previous;
  }
}

function chunkedResponse(text, chunkSize = 1) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += chunkSize)
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}

test('streams UTF-8 questions across arbitrary byte and CRLF boundaries', async () => {
  const question = {
    text: '이 탐구에서 맡은 역할은 무엇인가요?',
    kind: 'activity',
  };
  const source = `: keepalive\r\n\r\ndata: ${JSON.stringify({ type: 'question_start', kind: 'activity', mode: 'live' })}\r\n\r\ndata: ${JSON.stringify({ type: 'token', token: '이 탐구에서' })}\r\n\r\ndata: ${JSON.stringify({ type: 'question', question, mode: 'live' })}\r\n\r\n`;
  const events = [];
  await withResponse(chunkedResponse(source), async () => {
    await streamInterview(payload, new AbortController().signal, (event) =>
      events.push(event),
    );
  });
  assert.equal(events.length, 3);
  assert.equal(events[1].token, '이 탐구에서');
  assert.deepEqual(events[2].question, question);
});

test('handles final result frames without a trailing newline', async () => {
  const result = {
    summary: '답변의 구체성을 더해보세요.',
    turns: [],
    finish_reason: 'manual',
    elapsed_seconds: 35,
  };
  const events = [];
  await withResponse(
    chunkedResponse(
      `data: ${JSON.stringify({ type: 'result', result, mode: 'demo' })}`,
      7,
    ),
    async () => {
      await streamInterview(payload, new AbortController().signal, (event) =>
        events.push(event),
      );
    },
  );
  assert.deepEqual(events[0].result, result);
});

test('reports interrupted streams instead of treating partial questions as completed', async () => {
  await withResponse(
    chunkedResponse('data: {"type":"token","token":"부분 질문"}\n\n'),
    async () => {
      await assert.rejects(
        streamInterview(payload, new AbortController().signal, () => {}),
        /연결이 중간에 끊겼습니다/,
      );
    },
  );
});

test('surfaces server-side streaming errors', async () => {
  await withResponse(
    chunkedResponse(
      'data: {"type":"error","message":"질문 생성 연결을 확인해주세요."}\n\n',
    ),
    async () => {
      await assert.rejects(
        streamInterview(payload, new AbortController().signal, () => {}),
        /질문 생성 연결/,
      );
    },
  );
});

test('rejects non-streaming responses and malformed event payloads', async () => {
  await withResponse(
    new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
    async () => {
      await assert.rejects(
        streamInterview(payload, new AbortController().signal, () => {}),
        /면접 응답을 읽을 수 없습니다/,
      );
    },
  );
  await withResponse(chunkedResponse('data: broken-json\n\n'), async () => {
    await assert.rejects(
      streamInterview(payload, new AbortController().signal, () => {}),
      /면접 응답을 읽지 못했습니다/,
    );
  });
});

test('shows configured connection errors for unavailable providers', async () => {
  await withResponse(
    new Response(
      JSON.stringify({ detail: '면접 서비스가 아직 설정되지 않았습니다.' }),
      { status: 503 },
    ),
    async () => {
      await assert.rejects(
        streamInterview(payload, new AbortController().signal, () => {}),
        /면접 서비스가 아직 설정/,
      );
    },
  );
});
