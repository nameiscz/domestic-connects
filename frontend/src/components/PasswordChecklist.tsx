import { Check, Circle } from 'lucide-react';

interface PasswordRule {
  label: string;
  test: (value: string) => boolean;
}

const RULES: PasswordRule[] = [
  { label: '8–10 characters', test: (v) => v.length >= 8 && v.length <= 10 },
  { label: 'Uppercase letter (A–Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'Lowercase letter (a–z)', test: (v) => /[a-z]/.test(v) },
  { label: 'Number (0–9)', test: (v) => /[0-9]/.test(v) },
  { label: 'Special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/**
 * Live password rules checklist. Each row turns green with a check as soon
 * as the current password value satisfies it.
 */
export default function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="mt-2 mb-0 space-y-1" role="list">
      {RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs ${
              met ? 'text-emerald-600 font-medium' : 'text-ink-mute'
            }`}
          >
            {met ? (
              <Check size={13} strokeWidth={3} aria-hidden="true" />
            ) : (
              <Circle size={13} strokeWidth={2} aria-hidden="true" />
            )}
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
