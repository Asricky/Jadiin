'use client';
import { useRouter } from 'next/navigation';
import { UploadField } from './common';
export function PaymentUpload({
  eventId,
  slug,
  amount,
}: {
  eventId: string;
  slug: string;
  amount: number;
}) {
  const router = useRouter();
  return (
    <UploadField
      eventId={eventId}
      kind="payment"
      amount={amount}
      onDone={() => {
        router.push(`/e/${slug}/thank-you`);
        router.refresh();
      }}
    />
  );
}
