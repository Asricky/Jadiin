import type { Event, PaymentMethod } from '@/types/domain';
export const methodLabel = (m: PaymentMethod) =>
  `${m.bank_name} · ${m.bank_account_number} · ${m.bank_account_holder}`;
export function paymentMethods(event: Event): PaymentMethod[] {
  return [
    ...(event.bank_name && event.bank_account_number && event.bank_account_holder
      ? [
          {
            bank_name: event.bank_name,
            bank_account_number: event.bank_account_number,
            bank_account_holder: event.bank_account_holder,
          },
        ]
      : []),
    ...(event.additional_payment_methods || []),
  ];
}
