import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TOPIC_TABS = [
  {
    value: 'previous-activity',
    label: '이전 활동으로 만들기',
    description:
      '이전에 했던 활동, 프로젝트, 수업 경험을 바탕으로 탐구 주제를 확장하는 탭이에요.',
  },
  {
    value: 'detail-keyword',
    label: '세부 키워드로 만들기',
    description:
      '재료함에 모아둔 전공 세부 키워드를 바탕으로 탐구 주제를 구성하는 탭이에요.',
  },
] as const;

export default function TopicGenerationTabs() {
  return (
    <section className="w-full space-y-4">
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          탐구 주제 만들기
        </h2>
      </div>

      <Tabs defaultValue={TOPIC_TABS[0].value} className="w-full">
        <TabsList>
          {TOPIC_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TOPIC_TABS.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="rounded-xl border border-border/70 bg-background p-4 md:p-5"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm leading-6 text-muted-foreground">
                {tab.description}
              </p>
              <Button type="button" className="w-full md:w-auto">
                탐구 주제 생성
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
