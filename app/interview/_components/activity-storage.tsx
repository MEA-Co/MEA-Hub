'use client';

import { Cloud, Download, FolderOpen, LoaderCircle, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { useActivityDrafts } from '../_lib/use-activity-drafts';

export function ActivityStorage({
  drafts,
  consent,
  disabled,
}: {
  drafts: ReturnType<typeof useActivityDrafts>;
  consent: boolean;
  disabled: boolean;
}) {
  const available = drafts.availability === 'available';
  return (
    <section
      aria-labelledby="activity-storage-heading"
      className="mea-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2
            id="activity-storage-heading"
            className="flex items-center gap-2 text-[14px] font-semibold text-[#33332f]"
          >
            <Cloud className="size-4 text-[#666660]" aria-hidden />
            작성 중인 활동 보관
          </h2>
          <p className="mea-muted mt-2 text-[12px] leading-6">
            미완성 활동도 저장할 수 있어요. 서버 저장은 이 브라우저에서만 다시
            불러올 수 있고, 브라우저 데이터를 지우면 접근할 수 없습니다.
            JSON으로 내보내면 따로 보관할 수 있어요.
          </p>
          <p
            role="status"
            data-testid="activity-storage-status"
            className="mea-muted mt-2 text-[12px] leading-5"
          >
            {drafts.availability === 'checking'
              ? '활동 저장 연결을 확인하고 있어요.'
              : available
                ? `${drafts.hasSavedDraft ? '이 브라우저의 저장본이 있어요.' : '아직 저장된 활동이 없어요.'}${drafts.dirty ? ' 현재 입력에 저장하지 않은 변경이 있어요.' : ''}`
                : drafts.availability === 'unavailable'
                  ? '서버 저장이 아직 연결되지 않았어요. JSON 내보내기는 사용할 수 있습니다.'
                  : '저장 연결을 확인하지 못했어요. JSON 내보내기로 현재 내용을 보관할 수 있습니다.'}
          </p>
          {drafts.updatedAt && (
            <p className="mea-muted mt-1 text-[12px]">
              마지막 저장: {new Date(drafts.updatedAt).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg border-[#d8d8d4] bg-white px-3 text-[12px] text-[#44443f] shadow-none hover:bg-[#f5f5f2]"
            onClick={drafts.exportJSON}
          >
            <Download aria-hidden />
            활동 JSON 내보내기
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg border-[#d8d8d4] bg-white px-3 text-[12px] text-[#44443f] shadow-none hover:bg-[#f5f5f2]"
            onClick={drafts.load}
            disabled={!available || Boolean(drafts.busy) || disabled}
          >
            {drafts.busy === 'load' ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <FolderOpen aria-hidden />
            )}
            저장본 불러오기
          </Button>
          <Button
            type="button"
            className="mea-button-primary h-9 rounded-lg px-3 text-[12px] shadow-none"
            onClick={() => void drafts.save()}
            disabled={
              !available || Boolean(drafts.busy) || !consent || disabled
            }
          >
            {drafts.busy === 'save' ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <Save aria-hidden />
            )}
            활동 저장
          </Button>
        </div>
      </div>
      {!consent && available && (
        <p className="mt-3 border-l-2 border-[#d7c742] pl-3 text-[12px] leading-5 text-[#665a15]">
          원문·개인정보 제외 및 사용 동의를 확인하면 저장할 수 있어요.
        </p>
      )}
      {drafts.availability === 'error' && (
        <button
          type="button"
          onClick={() => void drafts.check()}
          className="mt-3 text-[12px] font-medium text-[#33332f] underline underline-offset-4"
        >
          저장 연결 다시 확인
        </button>
      )}
      {drafts.confirmLoad && (
        <div
          role="alertdialog"
          aria-labelledby="replace-draft-title"
          aria-describedby="replace-draft-description"
          className="mt-4 rounded-lg border border-[#e2d9a3] bg-[#fffce9] p-4"
        >
          <h3
            id="replace-draft-title"
            className="text-[14px] font-semibold text-[#403b22]"
          >
            현재 입력을 저장본으로 바꿀까요?
          </h3>
          <p
            id="replace-draft-description"
            className="mt-1 text-[12px] leading-6 text-[#6c6340]"
          >
            아직 저장하지 않은 변경이 있습니다. 필요한 내용은 먼저 JSON으로
            내보내주세요. 교체하면 현재 입력 대신 저장된 활동을 보여드립니다.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg border-[#d8d8d4] bg-white text-[12px] text-[#44443f] shadow-none hover:bg-[#f5f5f2]"
              onClick={drafts.cancelLoad}
            >
              현재 입력 유지
            </Button>
            <Button
              type="button"
              size="sm"
              className="mea-button-primary rounded-lg text-[12px] shadow-none"
              disabled={disabled || Boolean(drafts.busy)}
              onClick={() => void drafts.performLoad()}
            >
              저장본으로 교체
            </Button>
          </div>
        </div>
      )}
      {drafts.status && (
        <p role="status" className="mt-3 text-[12px] leading-6 text-[#496440]">
          {drafts.status}
        </p>
      )}
      {drafts.error && (
        <p role="alert" className="mt-3 text-[12px] leading-6 text-[#a62e25]">
          {drafts.error}
        </p>
      )}
    </section>
  );
}
