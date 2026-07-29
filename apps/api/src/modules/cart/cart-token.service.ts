import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import type { ApplicationConfiguration } from '../../platform/config';

export const CART_COOKIE_NAME = '__Host-bc.cart';
export const DEVELOPMENT_CART_COOKIE_NAME = 'bc.cart';

@Injectable()
export class CartTokenService {
  private readonly secrets: readonly string[];
  readonly cookieName: string;
  readonly secure: boolean;
  readonly anonymousTtlMs: number;

  constructor(config: ConfigService<ApplicationConfiguration, true>) {
    const application =
      config.getOrThrow<ApplicationConfiguration['session']>('session');
    this.secrets = application.secrets;
    this.anonymousTtlMs =
      config.getOrThrow<ApplicationConfiguration['cart']>(
        'cart',
      ).anonymousTtlMs;
    this.secure =
      config.getOrThrow<ApplicationConfiguration['environment']>(
        'environment',
      ) === 'production';
    this.cookieName = this.secure
      ? CART_COOKIE_NAME
      : DEVELOPMENT_CART_COOKIE_NAME;
  }

  issue(): { token: string; digest: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, digest: this.digest(token) };
  }

  digests(token: string | undefined): readonly string[] {
    if (!token || token.length < 40 || token.length > 64) return [];
    return this.secrets.map((secret) => this.digestWith(secret, token));
  }

  private digest(token: string): string {
    return this.digestWith(this.secrets[0], token);
  }

  private digestWith(secret: string, token: string): string {
    return createHmac('sha256', secret)
      .update('better-commerce:cart-token:v1\0')
      .update(token)
      .digest('hex');
  }
}
