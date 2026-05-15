import { ChevronLeft, HomeIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

import TopicGenerationTabs from './_components/TopicGenerationTabs';
import TopicsInputTable from './_components/TopicsInputTable';

export default function TopicsPage() {
  return (
    <main className="px-4 py-16 w-full max-w-[1280px] flex flex-col items-center">
      <section className="w-full max-w-[52rem] flex flex-col items-center">
        <div className="flex w-full">
          <h1 className="text-3xl font-semibold tracking-tight">
            탐구 주제 추천
          </h1>
        </div>
        <div className="flex w-full flex-col gap-8 items-center mt-8">
          <TopicsInputTable />
          <TopicGenerationTabs />
        </div>
      </section>
    </main>
  );
}
