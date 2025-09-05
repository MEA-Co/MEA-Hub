import { useMemo, useState } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { Activities } from '../_lib/http';

export default function ActivitiesView({
  activities,
}: {
  activities: Activities;
}) {
  type YearKey = keyof Activities;

  const years = useMemo(
    () => Object.keys(activities) as YearKey[],
    [activities],
  );
  const [open, setOpen] = useState<YearKey[]>(years);

  return (
    <div className="space-y-3 mt-6">
      <Accordion
        type="multiple"
        value={open as string[]}
        onValueChange={(v) => setOpen((Array.isArray(v) ? v : []) as YearKey[])}
        className="w-full"
      >
        {years.map((year) => {
          const bundle = activities[year];
          return (
            <AccordionItem key={year as string} value={year as string}>
              <AccordionTrigger className="px-4 py-2  hover:no-underline cursor-pointer">
                <div className="font-medium">{year}</div>
              </AccordionTrigger>
              <AccordionContent>
                <div
                  id={`year-body-${year as string}`}
                  className="p-4 space-y-4"
                >
                  <SectionSingle
                    title="자율활동"
                    text={bundle.창체?.자율활동}
                  />
                  <SectionSingle
                    title="진로활동"
                    text={bundle.창체?.진로활동}
                  />
                  <SectionSingle
                    title="동아리활동"
                    text={bundle.창체?.동아리활동}
                  />
                  <SectionSingle
                    title="희망분야"
                    text={bundle.창체?.희망분야}
                  />
                  <SubjectsView subjects={bundle.세특} />
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function SectionSingle({ title, text }: { title: string; text?: string }) {
  const v = (text ?? '').trim();
  if (!v) return null;

  return (
    <div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="whitespace-pre-wrap leading-relaxed">{v}</p>
    </div>
  );
}

function SubjectsView({ subjects }: { subjects: Record<string, string> }) {
  const names = Object.keys(subjects || {});
  if (names.length === 0) return null;

  return (
    <div>
      <h4 className="font-semibold mb-1">세특</h4>
      <div className="space-y-4">
        {names.map((name) => {
          const txt = (subjects[name] ?? '').trim();
          if (!txt) return null;
          return (
            <div key={name}>
              <div className="font-medium mb-1">{name}</div>
              <p className="whitespace-pre-wrap leading-relaxed">{txt}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
