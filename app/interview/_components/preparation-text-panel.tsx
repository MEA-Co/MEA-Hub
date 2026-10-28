'use client';

import { ChevronDown, Download } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import type { CircumstancesDraft } from '../_lib/circumstances';
import {
  exportPreparationText,
  importPreparationText,
} from '../_lib/preparation-text';
import type { Activity } from '../_lib/types';

export function PreparationTextPanel({
  activities,
  circumstances,
  onImport,
  disabled = false,
}: {
  activities: Activity[];
  circumstances: CircumstancesDraft;
  onImport: (value: ReturnType<typeof importPreparationText>) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const saveText = () => {
    setError('');
    setStatus('');
    try {
      const content = exportPreparationText(activities, circumstances);
      const url = URL.createObjectURL(
        new Blob([content], { type: 'text/plain;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `MEA-면접준비-${new Date().toISOString().slice(0, 10)}.txt`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('활동과 특이사항을 TXT 파일로 저장했어요.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : '입력한 내용을 확인해주세요.',
      );
    }
  };

  const importText = () => {
    if (disabled) return;
    setError('');
    setStatus('');
    try {
      const parsed = importPreparationText(text);
      onImport(parsed);
      setText('');
      setStatus(
        `${parsed.activities.length}개 활동을 가져왔어요. ${parsed.circumstances ? '특이사항도 함께 가져왔어요.' : 'TXT에 특이사항이 없어 기존 특이사항은 유지했어요.'}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'TXT 내용을 확인해주세요. 현재 입력은 그대로 유지됩니다.',
      );
    }
  };

  return (
    <section
      aria-labelledby="preparation-text-heading"
      className="mea-card mb-4 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="preparation-text-heading"
            className="text-sm font-semibold text-neutral-900"
          >
            작성 내용 보관하기
          </h2>
          <p className="mt-1 text-xs leading-6 text-neutral-500">
            활동과 특이사항은 자동 저장되지 않습니다. 필요할 때 TXT로 저장했다가
            내용을 붙여넣어 다시 사용하세요. 미완성 내용도 보관할 수 있어요.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-md bg-white"
          onClick={saveText}
        >
          <Download aria-hidden />
          활동·특이사항 TXT 저장
        </Button>
      </div>
      <details className="group mt-4 border-t border-neutral-100 pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-neutral-700">
          TXT 붙여넣기로 가져오기
          <ChevronDown className="size-4 group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-3 text-xs leading-6 text-neutral-500">
          저장한 TXT나 정리 도우미가 만든 TXT 내용을 붙여넣으세요. 생기부 원문과
          개인정보는 넣지 마세요. 가져오면 활동 목록을 교체합니다. 특이사항이
          없는 TXT는 현재 특이사항을 그대로 유지합니다.
        </p>
        <fieldset disabled={disabled} className="min-w-0">
          <label
            htmlFor="preparation-text"
            className="mt-3 block text-xs font-medium text-neutral-700"
          >
            활동·특이사항 TXT
          </label>
          <textarea
            id="preparation-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={200000}
            rows={7}
            placeholder="저장한 TXT 파일을 열어 내용을 여기에 붙여넣으세요."
            className="mea-input mt-2 resize-y font-mono text-xs leading-6"
          />
          <Button
            type="button"
            variant="outline"
            className="mea-button-primary mt-3 h-9 rounded-md"
            onClick={importText}
            disabled={disabled || !text.trim()}
          >
            TXT 내용 가져오기
          </Button>
        </fieldset>
        {disabled && (
          <p className="mt-2 text-xs leading-6 text-neutral-500">
            면접 중에는 작성 내용을 가져오거나 수정할 수 없어요.
          </p>
        )}
      </details>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="mt-3 text-sm text-neutral-600">
          {status}
        </p>
      )}
    </section>
  );
}
