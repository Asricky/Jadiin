'use client';
import { Input } from './ui/input';
import { useState } from 'react';
export const parseMoney = (value: FormDataEntryValue | null) =>
  Number(String(value ?? '').replace(/\./g, ''));
export function MoneyInput({
  name,
  defaultValue = 0,
  disabled = false,
}: {
  name: string;
  defaultValue?: number;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(
    defaultValue ? new Intl.NumberFormat('id-ID').format(defaultValue) : '',
  );
  return (
    <div className="money-field">
      <span>Rp</span>
      <Input
        name={name}
        type="text"
        inputMode="numeric"
        required
        disabled={disabled}
        placeholder="0"
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
          setValue(digits ? Number(digits).toLocaleString('id-ID') : '');
        }}
      />
    </div>
  );
}
