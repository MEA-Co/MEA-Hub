import { proxyInterview } from '@/lib/server/interview-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return proxyInterview(request, 'capabilities');
}
