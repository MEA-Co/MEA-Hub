import { isAgentCoreSpeechSessionUrl } from '../../../lib/speech-session-url';

export class SpeechSessionError extends Error {}

/** Request at record time so activity preparation cannot expire a connection. */
export async function requestSpeechSession(
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  try {
    const response = await fetcher('/api/interview/speech/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal,
    });
    if (!response.ok) throw new Error();
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== 'object' ||
      !('expires_in' in data) ||
      data.expires_in !== 60 ||
      !('websocket_url' in data) ||
      !isAgentCoreSpeechSessionUrl(data.websocket_url)
    )
      throw new Error();
    return data.websocket_url;
  } catch {
    // A provider or URL parser error may include the signed address. Discard it.
    throw new SpeechSessionError(
      '실시간 음성 연결을 준비하지 못했습니다. 다시 시도하거나 채팅으로 입력해주세요.',
    );
  }
}
