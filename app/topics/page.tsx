import { ChevronLeft, HomeIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

import TopicsInputTable from './_components/TopicsInputTable';

export default function TopicsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,rgba(250,250,250,1)_0%,rgba(244,244,245,0.75)_100%)] px-4 py-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex items-start">
          <Button asChild size="lg" variant="ghost">
            <Link href="/">
              <ChevronLeft />
              <HomeIcon />
            </Link>
          </Button>
        </div>

        <section className="space-y-3">
          <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">
            Topics Workspace
          </p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              주제 추천을 위한 기본 정보
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              전공 가치관, 희망 진로, 계열적합 역량을 먼저 정리해두는 공간이에요.
              지금 입력한 내용은 이후 `topics` 작업의 기본 재료로 이어서 사용할 수
              있게 구성해뒀어요.
            </p>
          </div>
        </section>

        <TopicsInputTable />
      </div>
    </main>
  );
}
