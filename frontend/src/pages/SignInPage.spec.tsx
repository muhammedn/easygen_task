import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SignInPage } from './SignInPage';

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    signUp: vi.fn(),
    signIn: vi.fn(),
    logout: vi.fn(),
    user: null,
    status: 'anonymous' as const,
  }),
}));

describe('SignInPage', () => {
  it('wires aria-invalid and aria-describedby on empty submit', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/password/i);

    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', 'email-error');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAttribute('aria-describedby', 'password-error');
  });
});
