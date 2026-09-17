import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SignUpPage } from './SignUpPage';

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    signUp: vi.fn(),
    signIn: vi.fn(),
    logout: vi.fn(),
    user: null,
    status: 'anonymous' as const,
  }),
}));

describe('SignUpPage', () => {
  it('wires aria-invalid and aria-describedby on empty submit', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /sign up/i }));

    const email = screen.getByLabelText(/email/i);
    const name = screen.getByLabelText(/^name$/i);
    const password = screen.getByLabelText(/password/i);

    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', 'email-error');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAttribute('aria-describedby', 'name-error');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password.getAttribute('aria-describedby')).toContain(
      'password-error',
    );
    expect(password.getAttribute('aria-describedby')).toContain(
      'password-hint',
    );
  });
});
