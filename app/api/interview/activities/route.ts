import { proxyActivityStorage } from '@/lib/server/interview-storage-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  return proxyActivityStorage(request);
}

export async function PUT(request: Request) {
  return proxyActivityStorage(request);
}
