import { CloudUploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

interface UploadZoneProps {
  onSelect: (file: File) => void;
  onUpload: () => void;
  isUploading?: boolean;
  fileName?: string | null;
  error?: string | null;
  hasData?: boolean;
}

export default function UploadZone({
  onSelect,
  onUpload,
  isUploading = false,
  fileName,
  error,
  hasData,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }
  function onDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    onSelect(f);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onSelect(f);
  }

  return (
    <div className="mt-6">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onInputChange}
        className="hidden"
      />

      <div
        onDragOver={(e) => {
          if (hasData) return;
          onDragOver(e);
        }}
        onDragEnter={(e) => {
          if (hasData) return;
          onDragEnter(e);
        }}
        onDragLeave={(e) => {
          if (hasData) return;
          onDragLeave(e);
        }}
        onDrop={(e) => {
          if (hasData) return;
          onDrop(e);
        }}
        onClick={() => {
          if (hasData) return;
          openPicker();
        }}
        aria-label="PDF 파일 드래그&드롭 또는 클릭하여 선택"
        role="button"
        tabIndex={0}
        className={[
          'flex flex-col items-center justify-center',
          'rounded-lg transition',
          'px-8 py-12 cursor-pointer select-none',
          isDragging ? 'bg-blue-100' : 'hover:bg-zinc-200 bg-zinc-100',
          isUploading || hasData ? 'opacity-60 pointer-events-none' : '',
        ].join(' ')}
      >
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center w-full">
            <CloudUploadIcon size={40} />
          </div>
          {fileName ? (
            <div className="text-sm text-zinc-600">
              선택된 파일: <span className="font-medium">{fileName}</span>
            </div>
          ) : (
            <div className="text-sm text-zinc-600">
              {hasData ? (
                <span className="font-medium">
                  이미 분석된 데이터가 있습니다
                </span>
              ) : (
                <>
                  <span className="font-medium">PDF를 여기로 드래그</span>하거나{' '}
                  <span className="underline">클릭하여 선택</span>하세요
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center">
        {onUpload && !hasData && (
          <Button
            size="lg"
            onClick={onUpload}
            disabled={isUploading || !fileName}
            className="disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? '분석 중…' : '생활기록부 업로드 & 분석'}
          </Button>
        )}
      </div>
      {error && <div className="mt-6 text-sm text-rose-500">{error}</div>}
    </div>
  );
}
