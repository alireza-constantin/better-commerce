import { BadRequestException } from '@nestjs/common';

const IRAN_MOBILE = /^989\d{9}$/;

/** Normalize Iranian mobile input to the canonical +98 E.164 digits. */
export function normalizeIranianMobile(input: string): string {
  const digits = input
    .trim()
    .normalize('NFKC')
    .replace(/[\s()-]/g, '')
    .replace(/^00/, '')
    .replace(/^\+/, '');
  const normalized = digits.startsWith('09') ? `98${digits.slice(1)}` : digits;
  if (!IRAN_MOBILE.test(normalized)) {
    throw new BadRequestException('Enter a valid Iranian mobile number');
  }
  return normalized;
}
