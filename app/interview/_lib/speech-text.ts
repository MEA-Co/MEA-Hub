/** A provider transcript is cumulative; always replace the same speech suffix. */
export function withSpeechTranscript(
  prefix: string,
  transcript: string,
): { text: string; truncated: boolean } {
  const speech = transcript.trim();
  const text = speech
    ? `${prefix}${prefix && !prefix.endsWith('\n') ? '\n' : ''}${speech}`
    : prefix;
  return { text: text.slice(0, 6000), truncated: text.length > 6000 };
}
