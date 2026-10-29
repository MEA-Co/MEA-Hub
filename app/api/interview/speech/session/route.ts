import { proxyInterview } from '@/lib/server/interview-proxy';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  return proxyInterview(request, 'speech/session');
}
