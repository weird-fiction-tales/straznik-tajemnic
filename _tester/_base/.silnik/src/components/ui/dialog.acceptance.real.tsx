import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import plMessages from '../../../messages/pl.json';
import enMessages from '../../../messages/en.json';
import { Dialog, DialogContent, DialogTitle } from './dialog';

jest.unmock('next-intl');

describe.each([
  ['pl', 'Zamknij', 'Close', plMessages],
  ['en', 'Close', 'Zamknij', enMessages],
] as const)('Shared Dialog close (%s)', (locale, closeLabel, otherLabel, messages) => {
  it('localizes its accessible name through the real provider and closes a controlled dialog with the keyboard', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();
    function ControlledDialog() {
      const [open, setOpen] = useState(true);
      return (
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Dialog open={open} onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            onOpenChange(nextOpen);
          }}>
            <DialogContent aria-describedby={undefined}>
              <DialogTitle>Dialog test</DialogTitle>
            </DialogContent>
          </Dialog>
        </NextIntlClientProvider>
      );
    }

    render(<ControlledDialog />);
    const close = screen.getByRole('button', { name: closeLabel });
    expect(screen.queryByRole('button', { name: otherLabel })).not.toBeInTheDocument();
    expect(close).toHaveClass('h-11', 'w-11', 'border-brass/35', 'focus-visible:ring-primary');
    close.focus();
    expect(close).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
