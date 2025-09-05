import { ChevronLeft, HomeIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

import RecordUploader from './_components/RecordUploader';

export default function RecordPage() {
  return (
    <div className="w-full flex flex-col p-4">
      <div className="flex items-start w-full">
        <Button asChild size="lg" variant="ghost">
          <Link href="/">
            <ChevronLeft />
            <HomeIcon />
          </Link>
        </Button>
      </div>
      <div className="mt-12 w-full flex items-center justify-center">
        <RecordUploader />
      </div>
    </div>
  );
}
