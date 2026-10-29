/** Accept only a freshly issued, origin-bound AgentCore speech session URL.
 * The short-lived signature authorizes this runtime connection only; never log it.
 */
export function isAgentCoreSpeechSessionUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 16000) return false;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'wss:' ||
      url.hostname !== 'bedrock-agentcore.ap-northeast-2.amazonaws.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash
    )
      return false;
    const path = /^\/runtimes\/([^/]+)\/ws$/.exec(url.pathname);
    if (
      !path ||
      !/^arn:aws:bedrock-agentcore:ap-northeast-2:\d{12}:runtime\/[A-Za-z][A-Za-z0-9_-]{1,128}$/.test(
        decodeURIComponent(path[1]),
      )
    )
      return false;
    const allowed = new Set([
      'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id',
      'X-Amzn-Bedrock-AgentCore-Runtime-Custom-Speech-Origin',
      'qualifier',
      'X-Amz-Algorithm',
      'X-Amz-Credential',
      'X-Amz-Date',
      'X-Amz-Expires',
      'X-Amz-SignedHeaders',
      'X-Amz-Security-Token',
      'X-Amz-Signature',
    ]);
    const keys = Array.from(url.searchParams.keys());
    if (
      keys.length !== allowed.size ||
      new Set(keys).size !== keys.length ||
      keys.some((key) => !allowed.has(key))
    )
      return false;
    const get = (key: string) => url.searchParams.get(key) ?? '';
    return (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        get('X-Amzn-Bedrock-AgentCore-Runtime-Session-Id'),
      ) &&
      get('X-Amzn-Bedrock-AgentCore-Runtime-Custom-Speech-Origin') ===
        'https://hub.mea.kr' &&
      get('qualifier') === 'DEFAULT' &&
      get('X-Amz-Algorithm') === 'AWS4-HMAC-SHA256' &&
      /^[A-Z0-9]{16,128}\/\d{8}\/ap-northeast-2\/bedrock-agentcore\/aws4_request$/.test(
        get('X-Amz-Credential'),
      ) &&
      /^\d{8}T\d{6}Z$/.test(get('X-Amz-Date')) &&
      get('X-Amz-Expires') === '60' &&
      get('X-Amz-SignedHeaders') === 'host;origin' &&
      get('X-Amz-Security-Token').length >= 16 &&
      /^[0-9a-f]{64}$/.test(get('X-Amz-Signature'))
    );
  } catch {
    return false;
  }
}
