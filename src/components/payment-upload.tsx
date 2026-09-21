'use client';
import { useRouter } from 'next/navigation';
import { UploadField } from './common';
export function PaymentUpload({ eventId, slug }: { eventId: string; slug: string }) {
  const router = useRouter();
  return (
    <UploadField
      eventId={eventId}
      kind="payment"
      onDone={() => {
        router.push(`/e/${slug}/thank-you`);
        router.refresh();
      }}
    />
  );
}
