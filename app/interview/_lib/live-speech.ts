export type LiveSpeechOptions = {
  url: string;
  stream: MediaStream;
  onReady: () => void;
  onFinalizing: () => void;
  onPartial: (text: string) => void;
  onComplete: (text: string) => void;
  onError: (message: string) => void;
};

export type LiveSpeechEnvironment = {
  createSocket: (url: string) => WebSocket;
  createContext: () => AudioContext;
  createWorklet: (context: AudioContext) => AudioWorkletNode;
};

export function createLiveSpeechSession(
  options: LiveSpeechOptions,
  environment?: LiveSpeechEnvironment,
) {
  const env = environment ?? {
    createSocket: (url: string) => new WebSocket(url),
    createContext: () => new AudioContext({ latencyHint: 'interactive' }),
    createWorklet: (context: AudioContext) =>
      new AudioWorkletNode(context, 'mea-pcm-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      }),
  };
  let socket: WebSocket | null = null;
  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let worklet: AudioWorkletNode | null = null;
  let gain: GainNode | null = null;
  let ended = false;
  let started = false;
  let stopping = false;
  let stopSent = false;
  let totalBytes = 0;
  let transcript = '';
  let captureTimer: ReturnType<typeof setTimeout> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveStart: (() => void) | null = null;
  let rejectStart: ((error: Error) => void) | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  };
  const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer) {
      clearTimeout(timer);
      timers.delete(timer);
    }
  };

  const releaseAudio = () => {
    options.stream.getTracks().forEach((track) => track.stop());
    if (worklet) {
      worklet.port.onmessage = null;
      worklet.onprocessorerror = null;
      worklet.disconnect();
    }
    source?.disconnect();
    gain?.disconnect();
    if (context && context.state !== 'closed')
      void context.close().catch(() => undefined);
    worklet = null;
    source = null;
    gain = null;
  };
  const cleanup = (cancelProvider: boolean) => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    releaseAudio();
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === 1) {
        if (cancelProvider) {
          try {
            socket.send(JSON.stringify({ type: 'cancel' }));
          } catch {
            /* Closing the socket also cancels the server stream. */
          }
        }
        socket.close(1000);
      } else if (socket.readyState === 0) socket.close();
    }
  };
  const fail = (message: string) => {
    if (ended) return;
    ended = true;
    cleanup(true);
    rejectStart?.(new Error(message));
    rejectStart = null;
    resolveStart = null;
    options.onError(message);
  };
  const sendStop = () => {
    if (ended || stopSent) return;
    if (!socket || socket.readyState !== 1) {
      fail(
        '음성 연결이 끊겼습니다. 인식된 답변을 확인하고 채팅으로 이어서 입력해주세요.',
      );
      return;
    }
    stopSent = true;
    socket.send(JSON.stringify({ type: 'stop' }));
    later(
      () =>
        fail(
          '마지막 문장을 확인하는 시간이 초과되었습니다. 인식된 답변을 확인하고 필요한 내용을 직접 입력해주세요.',
        ),
      20000,
    );
  };
  const stop = () => {
    if (ended || stopping || !started) return;
    stopping = true;
    clearTimer(captureTimer);
    options.onFinalizing();
    options.stream.getTracks().forEach((track) => track.stop());
    if (!worklet) {
      fail('녹음을 마무리하지 못했습니다. 인식된 답변을 확인해주세요.');
      return;
    }
    worklet.port.postMessage({ type: 'flush' });
    flushTimer = later(
      () =>
        fail(
          '마지막 음성을 전달하지 못했습니다. 인식된 답변을 확인하고 다시 시도해주세요.',
        ),
      2000,
    );
  };

  const start = async () => {
    if (ended) throw new Error('음성 입력이 취소되었습니다.');
    const ready = new Promise<void>((resolve, reject) => {
      resolveStart = resolve;
      rejectStart = reject;
    });
    // Attach the rejection handler before asynchronous setup can fail or be cancelled.
    void ready.catch(() => undefined);
    const startupTimer = later(
      () =>
        fail(
          '실시간 음성에 연결하지 못했습니다. 잠시 후 다시 시도하거나 채팅으로 입력해주세요.',
        ),
      15000,
    );
    try {
      const url = new URL(options.url);
      if (
        !['ws:', 'wss:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error('Invalid live speech address');
      context = env.createContext();
      if (!context.audioWorklet) throw new Error('AudioWorklet is unavailable');
      await context.audioWorklet.addModule('/worklets/pcm-capture.js');
      if (ended) return await ready;
      source = context.createMediaStreamSource(options.stream);
      gain = context.createGain();
      gain.gain.value = 0;
      worklet = env.createWorklet(context);
      worklet.onprocessorerror = () =>
        fail(
          '음성을 처리하지 못했습니다. 인식된 답변을 확인하고 다시 녹음하거나 채팅으로 입력해주세요.',
        );
      worklet.port.onmessage = (event: MessageEvent) => {
        if (ended) return;
        if (event.data?.type === 'pcm') {
          const buffer: unknown = event.data.buffer;
          if (
            !(buffer instanceof ArrayBuffer) ||
            !buffer.byteLength ||
            buffer.byteLength % 2 ||
            buffer.byteLength > 65536 ||
            !started ||
            stopSent
          ) {
            fail(
              '음성 데이터 전송을 중단했습니다. 인식된 답변을 확인해주세요.',
            );
            return;
          }
          if (
            !socket ||
            socket.readyState !== 1 ||
            socket.bufferedAmount + buffer.byteLength > 256 * 1024 ||
            totalBytes + buffer.byteLength > 120 * 32000
          ) {
            fail(
              '음성 연결이 원활하지 않아 녹음을 중단했습니다. 인식된 답변은 남아 있으니 채팅으로 이어서 입력해주세요.',
            );
            return;
          }
          totalBytes += buffer.byteLength;
          socket.send(buffer);
        } else if (event.data?.type === 'flushed' && stopping) {
          clearTimer(flushTimer);
          releaseAudio();
          sendStop();
        } else if (event.data?.type === 'limit') stop();
      };
      socket = env.createSocket(url.toString());
      socket.binaryType = 'arraybuffer';
      socket.onopen = () => {
        if (!ended && socket?.readyState === 1)
          socket.send(
            JSON.stringify({
              type: 'start',
              sample_rate: 16000,
              channels: 1,
              format: 'pcm_s16le',
            }),
          );
      };
      socket.onmessage = async (event: MessageEvent) => {
        if (ended) return;
        let message: unknown;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          fail(
            '음성 연결 응답을 확인하지 못했습니다. 인식된 답변을 확인해주세요.',
          );
          return;
        }
        if (!message || typeof message !== 'object' || !('type' in message)) {
          fail(
            '음성 연결 응답을 확인하지 못했습니다. 인식된 답변을 확인해주세요.',
          );
          return;
        }
        const payload = message as {
          type: unknown;
          text?: unknown;
          message?: unknown;
        };
        if (
          payload.type === 'ready' &&
          !started &&
          context &&
          source &&
          worklet &&
          gain
        ) {
          started = true;
          source.connect(worklet);
          worklet.connect(gain);
          gain.connect(context.destination);
          try {
            await context.resume();
          } catch {
            fail('마이크를 시작하지 못했습니다. 브라우저 권한을 확인해주세요.');
            return;
          }
          if (ended) return;
          clearTimer(startupTimer);
          captureTimer = later(stop, 120000);
          options.onReady();
          resolveStart?.();
          resolveStart = null;
          rejectStart = null;
        } else if (
          payload.type === 'transcript' &&
          started &&
          typeof payload.text === 'string' &&
          payload.text.length <= 6000
        ) {
          transcript = payload.text;
          options.onPartial(transcript);
        } else if (
          payload.type === 'complete' &&
          stopSent &&
          typeof payload.text === 'string' &&
          payload.text.length <= 6000
        ) {
          const final = payload.text.trim() || transcript.trim();
          if (!final) {
            fail(
              '인식된 말이 없습니다. 채팅으로 입력하거나 다시 녹음해주세요.',
            );
            return;
          }
          ended = true;
          cleanup(false);
          options.onComplete(final);
        } else if (payload.type === 'error') {
          fail(
            typeof payload.message === 'string' && payload.message.length <= 500
              ? payload.message
              : '음성 인식을 마치지 못했습니다. 인식된 답변을 확인해주세요.',
          );
        } else {
          fail(
            '음성 연결 응답을 확인하지 못했습니다. 인식된 답변을 확인해주세요.',
          );
        }
      };
      socket.onerror = () =>
        fail(
          '실시간 음성 연결에 문제가 생겼습니다. 인식된 답변을 확인하고 채팅으로 이어서 입력해주세요.',
        );
      socket.onclose = () =>
        fail(
          '음성 연결이 끊겼습니다. 인식된 답변을 확인하고 필요한 내용을 직접 입력해주세요.',
        );
    } catch {
      fail(
        '실시간 마이크를 시작하지 못했습니다. 브라우저 권한을 확인하거나 채팅으로 입력해주세요.',
      );
    }
    await ready;
  };

  const cancel = () => {
    if (ended) return;
    ended = true;
    cleanup(true);
    rejectStart?.(new Error('음성 입력이 취소되었습니다.'));
    rejectStart = null;
    resolveStart = null;
  };
  return { start, stop, cancel };
}
