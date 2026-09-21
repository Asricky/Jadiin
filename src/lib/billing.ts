import type { Bundle } from '@/types/domain';
export function paymentSummary(data: Pick<Bundle, 'participants' | 'payments' | 'event'>) {
  const rows = data.participants.map((participant) => {
    const payment = data.payments.find((p) => p.participant_id === participant.id);
    const protectedAmount = payment && payment.status !== 'REJECTED';
    return {
      participant,
      payment,
      due: protectedAmount ? payment.amount : data.event.cost_per_person || 0,
      status: payment?.status || 'NOT_SUBMITTED',
    };
  });
  const expected = rows.reduce((n, r) => n + r.due, 0);
  const verified = rows.filter((r) => r.status === 'VERIFIED').reduce((n, r) => n + r.due, 0);
  const pending = rows.filter((r) => r.status === 'PENDING').reduce((n, r) => n + r.due, 0);
  return { rows, expected, verified, pending, outstanding: expected - verified };
}
