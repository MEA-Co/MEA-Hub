import { ClipboardIcon, PaintbrushIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="font-bold text-xl md:text-5xl mt-24">Welcome, MEA Hub</h1>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3 w-full max-w-lg">
        <Link href="/record" className="w-full">
          <Button variant="outline" className="w-full" size="lg">
            <div className="flex items-center justify-center w-full gap-1">
              <ClipboardIcon />
              <p>생활기록부 업로드</p>
            </div>
          </Button>
        </Link>
        {/* <Link href="/interview" className="w-full">
          <Button variant="outline" className="w-full" size="lg">
            <div className="flex items-center justify-center w-full gap-1">
              <MicIcon />
              <p>면접</p>
            </div>
          </Button>
        </Link> */}
        <Link href="/diagnosis" className="w-full">
          <Button variant="outline" className="w-full" size="lg">
            <div className="flex items-center justify-center w-full gap-1">
              <ClipboardIcon />
              <p>진학전략</p>
            </div>
          </Button>
        </Link>
        <Link href="/topics" className="w-full">
          <Button variant="outline" className="w-full" size="lg">
            <div className="flex items-center justify-center w-full gap-1">
              <PaintbrushIcon />
              <p>주제 추천</p>
            </div>
          </Button>
        </Link>
      </div>
    </div>
  );
}
