import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import PasswordChecklist from './PasswordChecklist';

const ruleItems = () =>
  screen.getAllByRole('listitem').map((li) => ({
    text: within(li).getByText(/./).textContent,
    met: li.classList.contains('text-success'),
  }));

describe('PasswordChecklist', () => {
  it('renders all five password rules', () => {
    render(<PasswordChecklist value="" />);

    expect(screen.getByText('8–10 characters')).toBeInTheDocument();
    expect(screen.getByText('Uppercase letter (A–Z)')).toBeInTheDocument();
    expect(screen.getByText('Lowercase letter (a–z)')).toBeInTheDocument();
    expect(screen.getByText('Number (0–9)')).toBeInTheDocument();
    expect(screen.getByText('Special character')).toBeInTheDocument();
  });

  it('shows every rule as unmet when the password is empty', () => {
    render(<PasswordChecklist value="" />);

    expect(ruleItems().every((item) => !item.met)).toBe(true);
  });

  it('ticks a rule as soon as the password satisfies it', () => {
    render(<PasswordChecklist value="Newsec1!" />);

    const items = ruleItems();
    expect(items).toHaveLength(5);
    expect(items.every((item) => item.met)).toBe(true);
  });

  it('marks only the satisfied rules for a partial password', () => {
    render(<PasswordChecklist value="secret123" />);

    const byText = Object.fromEntries(
      ruleItems().map((item) => [item.text, item.met])
    );
    // Length and lowercase + digit rules pass…
    expect(byText['8–10 characters']).toBe(true);
    expect(byText['Lowercase letter (a–z)']).toBe(true);
    expect(byText['Number (0–9)']).toBe(true);
    // …but uppercase and special character are still missing.
    expect(byText['Uppercase letter (A–Z)']).toBe(false);
    expect(byText['Special character']).toBe(false);
  });

  it('flags an over-long password against the length rule', () => {
    render(<PasswordChecklist value="Newsecret12345!" />);

    const byText = Object.fromEntries(
      ruleItems().map((item) => [item.text, item.met])
    );
    expect(byText['8–10 characters']).toBe(false);
  });
});
