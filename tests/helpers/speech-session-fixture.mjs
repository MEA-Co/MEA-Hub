// Deliberately fake AWS signature data. These URLs cannot authorize a request.
export function speechSessionFixture(
  session = '01234567-89ab-4cde-8fab-0123456789ab',
) {
  const date = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const arn =
    'arn:aws:bedrock-agentcore:ap-northeast-2:000000000000:runtime/synthetic_runtime-only';
  const url = new URL(
    `wss://bedrock-agentcore.ap-northeast-2.amazonaws.com/runtimes/${encodeURIComponent(arn)}/ws`,
  );
  Object.entries({
    'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': session,
    'X-Amzn-Bedrock-AgentCore-Runtime-Custom-Speech-Origin':
      'https://hub.mea.kr',
    qualifier: 'DEFAULT',
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `ASIASYNTHETIC0000000/${date.slice(0, 8)}/ap-northeast-2/bedrock-agentcore/aws4_request`,
    'X-Amz-Date': date,
    'X-Amz-Expires': '60',
    'X-Amz-SignedHeaders': 'host;origin',
    'X-Amz-Security-Token': 'synthetic-not-an-aws-session-token',
    'X-Amz-Signature': '0'.repeat(64),
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}
