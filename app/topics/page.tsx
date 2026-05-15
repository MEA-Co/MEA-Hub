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

        <section>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              탐구 주제 추천
            </h1>
          </div>
        </section>
        <TopicsInputTable />
      </div>
    </main>
  );
}
