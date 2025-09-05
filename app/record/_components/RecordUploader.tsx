'use client';

import React, { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiUrl } from '@/lib/utils';

import {
  AppError,
  ERROR_MESSAGES,
  fetchJson,
  isRecordOk,
  RecordOk,
  RecordRes,
} from '../_lib/http';

import ActivitiesView from './ActivitiesView';
import UploadZone from './UploadZone';

export default function RecordUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecordOk | null>(null);

  const [isUploading, setIsUploading] = useState(false);

  const totalItems = useMemo(() => {
    if (!data) return 0;

    return Object.values(data.activities).reduce((acc, bundle) => {
      const ccChangche =
        Number(Boolean(bundle.창체?.자율활동?.trim())) +
        Number(Boolean(bundle.창체?.진로활동?.trim())) +
        Number(Boolean(bundle.창체?.동아리활동?.trim())) +
        Number(Boolean(bundle.창체?.희망분야?.trim()));

      const ccSeteuk = Object.values(bundle.세특 || {}).reduce(
        (a, txt) => a + Number(Boolean((txt ?? '').trim())),
        0,
      );

      return acc + ccChangche + ccSeteuk;
    }, 0);
  }, [data]);

  async function handleUpload(f?: File) {
    const target = f ?? file;
    if (!target) return;
    setIsUploading(true);
    setError(null);
    setData(null);
    try {
      const fd = new FormData();
      fd.append('file', target);
      const res = await fetchJson<RecordRes>(apiUrl('/api/record'), {
        method: 'POST',
        body: fd,
        timeoutMs: 30000,
      });

      if (!isRecordOk(res)) {
        const code = res.error ?? 'server_invalid';
        const msg =
          ERROR_MESSAGES[code] ?? '업로드한 파일을 처리할 수 없습니다.';
        throw new AppError(msg, { code });
      }

      setData(res);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '업로드 중 오류가 발생했습니다.',
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setData(null);
    setError(null);
  }

  function handleDownloadJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data.activities, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.filename.replace(/\.pdf$/i, '') || 'activities'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full max-w-4xl">
      <Card>
        <CardContent>
          <p className="font-semibold text-lg">생활기록부 업로드</p>
          <UploadZone
            isUploading={isUploading}
            fileName={file?.name ?? null}
            error={error}
            onSelect={(f) => {
              if (
                f.type !== 'application/pdf' &&
                !f.name.toLowerCase().endsWith('.pdf')
              ) {
                setError('PDF 파일만 업로드할 수 있습니다.');
                return;
              }
              setError(null);
              setFile(f);
            }}
            onUpload={() => handleUpload()}
            hasData={!!data}
          />
          {data && (
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600">
                  텍스트 {data.chars.toLocaleString()}자 / 항목{' '}
                  {totalItems.toLocaleString()}개
                </div>
                <div className="flex items-center">
                  <Button onClick={handleReset} variant="ghost">
                    초기화
                  </Button>
                  <Button
                    className="hidden md:block"
                    onClick={handleDownloadJson}
                    variant="link"
                  >
                    JSON 다운로드
                  </Button>
                </div>
              </div>

              <ActivitiesView activities={data.activities} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
