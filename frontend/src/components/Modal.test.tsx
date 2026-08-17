import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

const DEFAULT_CONTENT = (
  <div className="modal-content">
    <h5 id="test-modal-title">Test modal</h5>
    <button type="button">First</button>
    <button type="button" disabled>
      Disabled
    </button>
    <button type="button">Second</button>
    <a href="#section">Link</a>
  </div>
);

const renderModal = (props: Record<string, unknown> = {}, content: ReactNode = DEFAULT_CONTENT) =>
  render(
    <Modal labelledBy="test-modal-title" onClose={vi.fn()} {...props}>
      {content}
    </Modal>
  );

describe('Modal', () => {
  it('renders an aria-modal dialog labelled by the heading id', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Test modal' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('role', 'dialog');
  });

  it('focuses the element marked data-autofocus on open', () => {
    renderModal({}, (
      <div className="modal-content">
        <h5 id="test-modal-title">Test modal</h5>
        <input type="text" data-autofocus />
        <button type="button">Close</button>
      </div>
    ));

    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('falls back to focusing the dialog itself when nothing is marked autofocus', () => {
    renderModal();

    expect(screen.getByRole('dialog', { name: 'Test modal' })).toHaveFocus();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    const { container } = renderModal({ onClose });

    fireEvent.keyDown(container, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click but not on clicks inside the dialog', () => {
    const onClose = vi.fn();
    const { container } = renderModal({ onClose });
    const shell = container.querySelector('.modal');
    const content = shell?.querySelector('.modal-content');
    expect(shell).not.toBeNull();
    expect(content).not.toBeNull();

    fireEvent.mouseDown(content!);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(shell!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('focus trap', () => {
    it('moves focus forward between focusables, skipping disabled ones', async () => {
      const user = userEvent.setup();
      renderModal();

      const first = screen.getByRole('button', { name: 'First' });
      const second = screen.getByRole('button', { name: 'Second' });
      first.focus();

      await user.tab();
      expect(second).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('link', { name: 'Link' })).toHaveFocus();
    });

    it('wraps Tab from the last focusable back to the first', () => {
      renderModal();

      const last = screen.getByRole('link', { name: 'Link' });
      const first = screen.getByRole('button', { name: 'First' });
      last.focus();

      fireEvent.keyDown(last, { key: 'Tab' });

      expect(first).toHaveFocus();
    });

    it('wraps Shift+Tab from the first focusable back to the last', () => {
      renderModal();

      const first = screen.getByRole('button', { name: 'First' });
      const last = screen.getByRole('link', { name: 'Link' });
      first.focus();

      fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });

      expect(last).toHaveFocus();
    });

    it('leaves focus inside the modal on a plain Tab from the middle', async () => {
      const user = userEvent.setup();
      renderModal();

      const second = screen.getByRole('button', { name: 'Second' });
      second.focus();

      await user.tab();

      // The trap does not intervene mid-list, so focus advances to the link.
      expect(screen.getByRole('link', { name: 'Link' })).toHaveFocus();
    });
  });

  describe('open/close lifecycle', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open modal
          </button>
          {open && (
            <Modal onClose={() => setOpen(false)} labelledBy="harness-modal-title">
              <div className="modal-content">
                <h5 id="harness-modal-title">Harness modal</h5>
                <button type="button" data-autofocus>
                  Inside
                </button>
              </div>
            </Modal>
          )}
        </>
      );
    }

    it('locks background scroll while open and restores it on close', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      expect(document.body.style.overflow).toBe('');

      await user.click(screen.getByRole('button', { name: 'Open modal' }));
      expect(document.body.style.overflow).toBe('hidden');

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('');
    });

    it('restores focus to the trigger when the modal closes', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const trigger = screen.getByRole('button', { name: 'Open modal' });
      await user.click(trigger);
      expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});
