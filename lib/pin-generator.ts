import { randomBytes } from 'crypto';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit O,0,I,1 for readability

/**
 * Generate a random PIN in format: XXXX-XXXX-XXXX
 */
export function generatePin(): string {
  const bytes = randomBytes(12);
  let pin = '';
  for (let i = 0; i < 12; i++) {
    pin += CHARS[bytes[i] % CHARS.length];
    if (i === 3 || i === 7) pin += '-';
  }
  return pin;
}

/**
 * Generate a master access number in format: MASTER-XXXX
 */
export function generateMasterNumber(): string {
  const bytes = randomBytes(4);
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CHARS[bytes[i] % CHARS.length];
  }
  return `MASTER-${suffix}`;
}

/**
 * Mask a PIN for display — shows only last 4 chars
 * e.g., "ABCD-EFGH-1234" → "XXXX-XXXX-1234"
 */
export function maskPin(pin: string): string {
  const parts = pin.split('-');
  if (parts.length === 3) {
    return `XXXX-XXXX-${parts[2]}`;
  }
  // Fallback: mask all but last 4 chars
  const visible = pin.slice(-4);
  return pin.slice(0, -4).replace(/[A-Z0-9]/g, 'X') + visible;
}
