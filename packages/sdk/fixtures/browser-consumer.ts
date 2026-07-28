import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import { createBrowserBetterCommerceClient } from '@better-commerce/sdk/browser';

const client = createBrowserBetterCommerceClient({
  baseUrl: 'https://shop.example.test',
});

const exampleUser: BetterCommerceApiSchemas['SafeUserResponseDto'] | undefined =
  undefined;

void exampleUser;
void client.GET('/api/v1/auth/me');
