'use client';

import { Check, ChevronDown, Clipboard, FileText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { PREPARATION_PROMPT } from '../_lib/types';

export function PreparationGuide() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const copyPrompt = async () => {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(PREPARATION_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError('아래 프롬프트를 펼쳐 직접 선택해 복사해주세요.');
    }
  };

  return (
    <section
      aria-labelledby="preparation-guide-heading"
      className="mea-card mea-surface mb-4 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <FileText
          className="mt-0.5 size-4 shrink-0 text-neutral-500"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2
            id="preparation-guide-heading"
            className="text-sm font-semibold text-neutral-800"
          >
            활동 정리 도우미
          </h2>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            프롬프트를 복사해 원하는 도구에서 정리한 뒤, 직접 검토한 정보만
            가져오세요. 느낀점이 메모에 없다면 새로 만들지 말고 비워두세요.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-8 rounded-md border-neutral-300 bg-white px-3 text-xs text-neutral-800 hover:bg-neutral-100"
            onClick={() => void copyPrompt()}
          >
            {copied ? <Check aria-hidden /> : <Clipboard aria-hidden />}
            {copied ? '복사했어요' : '활동 정리 프롬프트 복사'}
          </Button>
          {copyError && (
            <p role="status" className="mt-2 text-sm text-neutral-600">
              {copyError}
            </p>
          )}
          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-neutral-500">
              프롬프트 펼쳐보기
              <ChevronDown
                className="size-3.5 group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <pre
              className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-4 font-sans text-xs leading-6 text-neutral-600"
              tabIndex={0}
            >
              {PREPARATION_PROMPT}
            </pre>
          </details>
        </div>
      </div>
    </section>
  );
}
