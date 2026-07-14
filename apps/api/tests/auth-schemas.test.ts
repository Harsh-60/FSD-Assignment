import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '../src/validators/schemas.js';

describe('registerSchema', () => {
  it('accepts valid registration data', () => {
    const result = registerSchema.parse({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'securepassword',
    });
    expect(result.email).toBe('alice@example.com');
    expect(result.name).toBe('Alice');
  });

  it('rejects a name that is too short', () => {
    expect(() =>
      registerSchema.parse({ name: 'A', email: 'alice@example.com', password: 'securepassword' }),
    ).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() =>
      registerSchema.parse({ name: 'Alice', email: 'not-an-email', password: 'securepassword' }),
    ).toThrow();
  });

  it('rejects a password that is too short', () => {
    expect(() =>
      registerSchema.parse({ name: 'Alice', email: 'alice@example.com', password: 'short' }),
    ).toThrow();
  });
});

describe('loginSchema', () => {
  it('accepts valid login credentials', () => {
    const result = loginSchema.parse({ email: 'alice@example.com', password: 'securepassword' });
    expect(result.email).toBe('alice@example.com');
  });

  it('rejects missing password', () => {
    expect(() => loginSchema.parse({ email: 'alice@example.com' })).toThrow();
  });

  it('rejects missing email', () => {
    expect(() => loginSchema.parse({ password: 'securepassword' })).toThrow();
  });
});
