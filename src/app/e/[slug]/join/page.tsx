import { redirect } from 'next/navigation';
export default async function Join({ params }: { params: Promise<{ slug: string }> }) {
  redirect(`/e/${(await params).slug}/stage-1`);
}
