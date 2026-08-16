import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import {
  CATALOG_MODULE_CONTRACT,
  type CatalogModuleContract,
} from '../catalog';
import {
  formatMoney,
  PRICING_MODULE_CONTRACT,
  type PricingModuleContract,
} from '../pricing';
import {
  INVENTORY_MODULE_CONTRACT,
  type InventoryModuleContract,
} from '../inventory';
import {
  SHIPPING_MODULE_CONTRACT,
  type DeliveryAddress,
  type ShippingModuleContract,
} from '../shipping';
import {
  PAYMENTS_MODULE_CONTRACT,
  type PaymentsModuleContract,
} from '../payments';
import type { DatabaseTransactionContext } from '../../platform/database';
import type { ApplicationConfiguration } from '../../platform/config';
import { CartClaim } from './cart-claim.entity';
import { CartLine } from './cart-line.entity';
import { Cart, CartStatus } from './cart.entity';
import { CartError } from './cart.error';
import type { CartModuleContract } from './cart.contract';
import type { CartOwner, CartView, CheckoutCart } from './cart.types';
import { CartPersistence } from './persistence/cart.persistence';
import {
  PROMOTIONS_MODULE_CONTRACT,
  type PromotionsModuleContract,
} from '../promotions';

const MAX_LINES = 100;
const MAX_QUANTITY = 999;

@Injectable()
export class CartService implements CartModuleContract {
  private readonly configuration: ApplicationConfiguration['cart'];

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService<ApplicationConfiguration, true>,
    @Inject(CATALOG_MODULE_CONTRACT)
    private readonly catalog: CatalogModuleContract,
    @Inject(PRICING_MODULE_CONTRACT)
    private readonly pricing: PricingModuleContract,
    @Inject(INVENTORY_MODULE_CONTRACT)
    private readonly inventory: InventoryModuleContract,
    private readonly persistence: CartPersistence,
    @Inject(SHIPPING_MODULE_CONTRACT)
    private readonly shipping: ShippingModuleContract,
    @Inject(PAYMENTS_MODULE_CONTRACT)
    private readonly payments: PaymentsModuleContract,
    @Inject(PROMOTIONS_MODULE_CONTRACT)
    private readonly promotions: PromotionsModuleContract,
  ) {
    this.configuration =
      config.getOrThrow<ApplicationConfiguration['cart']>('cart');
  }

  async getCurrent(owner: CartOwner): Promise<CartView> {
    const cart = await this.findActive(this.dataSource.manager, owner, false);
    if (!cart || this.isExpired(cart)) return this.empty();
    return this.view(this.dataSource.manager, cart);
  }

  async setQuantity(
    owner: CartOwner,
    expectedVersion: number,
    variantId: string,
    quantity: number,
  ): Promise<CartView> {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new CartError('cart.line_invalid', 'تعداد کالا نامعتبر است.');
    }
    const [resolution] = await this.catalog.resolvePurchasableVariants([
      variantId,
    ]);
    if (!resolution?.eligible) {
      throw new CartError(
        'cart.line_invalid',
        'این تنوع کالا در حال حاضر قابل خرید نیست.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      let cart = await this.findActive(manager, owner, true);
      if (cart && this.isExpired(cart)) {
        await this.expire(manager, cart);
        cart = null;
      }
      if (!cart) {
        if (expectedVersion !== 0) this.versionConflict(0);
        cart = await manager.save(
          manager.create(Cart, {
            userId: owner.userId ?? null,
            anonymousTokenDigest:
              owner.anonymousTokenDigest ??
              owner.anonymousTokenDigests?.[0] ??
              null,
            status: CartStatus.ACTIVE,
            version: 1,
            expiresAt: this.expiry(Boolean(owner.userId)),
            terminalAt: null,
            successorCartId: null,
          }),
        );
      } else {
        this.assertVersion(cart, expectedVersion);
      }

      const repository = manager.getRepository(CartLine);
      let line = await repository.findOne({
        where: { cartId: cart.id, variantId },
      });
      if (!line) {
        const count = await repository.countBy({ cartId: cart.id });
        if (count >= MAX_LINES) {
          throw new CartError(
            'cart.limit_exceeded',
            'سبد خرید نمی‌تواند بیش از ۱۰۰ ردیف داشته باشد.',
          );
        }
        line = repository.create({ cartId: cart.id, variantId, quantity });
      } else {
        line.quantity = quantity;
      }
      await repository.save(line);
      if (expectedVersion !== 0) await this.bump(manager, cart);
      return this.view(manager, cart);
    });
  }

  async removeLine(
    owner: CartOwner,
    expectedVersion: number,
    lineId: string,
  ): Promise<CartView> {
    return this.mutateExisting(
      owner,
      expectedVersion,
      async (manager, cart) => {
        const result = await manager
          .getRepository(CartLine)
          .delete({ id: lineId, cartId: cart.id });
        if (!result.affected) {
          throw new CartError('cart.not_found', 'ردیف سبد خرید پیدا نشد.');
        }
      },
    );
  }

  async clear(owner: CartOwner, expectedVersion: number): Promise<CartView> {
    return this.mutateExisting(
      owner,
      expectedVersion,
      async (manager, cart) => {
        await manager.getRepository(CartLine).delete({ cartId: cart.id });
      },
    );
  }

  async prepareCheckout(
    owner: CartOwner,
    expectedVersion: number,
    deliveryAddress: DeliveryAddress,
    promotionCode?: string | null,
  ) {
    const cart = await this.findActive(this.dataSource.manager, owner, false);
    if (!cart || this.isExpired(cart)) {
      throw new CartError('cart.not_found', 'سبد خرید فعال پیدا نشد.');
    }
    this.assertVersion(cart, expectedVersion);
    const lines = await this.dataSource.getRepository(CartLine).findBy({
      cartId: cart.id,
    });
    if (!lines.length) {
      throw new CartError('cart.line_invalid', 'سبد خرید خالی است.');
    }
    const variantIds = lines.map((line) => line.variantId);
    const [variants, prices, availability] = await Promise.all([
      this.catalog.resolvePurchasableVariants(variantIds),
      this.pricing.readPublicVariantPrices(variantIds),
      this.inventory.readPublicVariantAvailability(variantIds),
    ]);
    const snapshotFacts =
      await this.catalog.getVariantSnapshotFacts(variantIds);
    const priceByVariant = new Map(
      prices.map((price) => [price.variantId, price.unitPrice]),
    );
    const availableByVariant = new Map(
      availability.map((item) => [item.variantId, item.availability]),
    );
    if (
      variants.length !== lines.length ||
      variants.some((variant) => !variant.eligible) ||
      lines.some(
        (line) =>
          !priceByVariant.has(line.variantId) ||
          availableByVariant.get(line.variantId) !== 'in_stock',
      )
    ) {
      throw new CartError(
        'cart.line_invalid',
        'یک یا چند کالای سبد خرید در حال حاضر قابل سفارش نیست.',
      );
    }
    const currency = prices[0]?.unitPrice.currency;
    if (
      !currency ||
      prices.some((price) => price.unitPrice.currency !== currency)
    ) {
      throw new CartError(
        'cart.line_invalid',
        'کالاهای سبد خرید باید ارز یکسان داشته باشند.',
      );
    }
    const merchandiseSubtotal = lines.reduce((total, line) => {
      const price = priceByVariant.get(line.variantId);
      if (!price) return total;
      return total + price.minorAmount * BigInt(line.quantity);
    }, 0n);
    const factByVariant = new Map(
      snapshotFacts.map((fact) => [fact.variantId, fact]),
    );
    const promotion = await this.promotions.quoteCode({
      code: promotionCode,
      currency,
      lines: lines.map((line) => {
        const price = priceByVariant.get(line.variantId)!;
        const fact = factByVariant.get(line.variantId);
        return {
          variantId: line.variantId,
          amount: {
            minorAmount: price.minorAmount * BigInt(line.quantity),
            currency,
          },
          categoryIds: fact?.categoryIds,
          collectionIds: fact?.collectionIds,
        };
      }),
    });
    const shippingMethods = await this.shipping.quote(
      {
        ...deliveryAddress,
        country: deliveryAddress.country.toUpperCase(),
      },
      { minorAmount: merchandiseSubtotal, currency },
    );
    return {
      cartId: cart.id,
      cartVersion: cart.version,
      merchandiseSubtotal: formatMoney({
        minorAmount: merchandiseSubtotal,
        currency,
      }),
      shippingMethods: shippingMethods.map((quote) => ({
        methodId: quote.methodId,
        methodTitle: quote.methodTitle,
        charge: formatMoney(quote.charge),
        grandTotal: formatMoney({
          minorAmount:
            merchandiseSubtotal -
            promotion.discount.minorAmount +
            quote.charge.minorAmount,
          currency,
        }),
      })),
      promotion: {
        ...promotion,
        discount: formatMoney(promotion.discount),
        allocations: promotion.allocations.map((allocation) => ({
          variantId: allocation.variantId,
          amount: formatMoney(allocation.amount),
        })),
      },
      paymentMethods: [...this.payments.listManualPaymentMethods()],
    };
  }

  async claim(
    userId: string,
    anonymousTokenDigests: readonly string[],
    expectedVersion: number,
  ): Promise<CartView> {
    return this.dataSource.transaction(async (manager) => {
      const replay = await manager.getRepository(CartClaim).findOne({
        where: anonymousTokenDigests.map((digest) => ({
          anonymousTokenDigest: digest,
          userId,
        })),
      });
      if (replay && replay.expiresAt > new Date()) {
        const cart = await manager.getRepository(Cart).findOneBy({
          id: replay.cartId,
          userId,
          status: CartStatus.ACTIVE,
        });
        return cart ? this.view(manager, cart) : this.empty();
      }

      const anonymous = await this.findActive(
        manager,
        { anonymousTokenDigest: anonymousTokenDigests[0] },
        true,
        anonymousTokenDigests,
      );
      let customer = await this.findActive(manager, { userId }, true);
      if (!anonymous || this.isExpired(anonymous)) {
        if (anonymous) await this.expire(manager, anonymous);
        return customer ? this.view(manager, customer) : this.empty();
      }
      this.assertVersion(anonymous, expectedVersion);

      if (!customer || this.isExpired(customer)) {
        if (customer) await this.expire(manager, customer);
        anonymous.userId = userId;
        anonymous.anonymousTokenDigest = null;
        anonymous.expiresAt = this.expiry(true);
        anonymous.version += 1;
        customer = await manager.save(anonymous);
      } else {
        const anonymousLines = await manager
          .getRepository(CartLine)
          .findBy({ cartId: anonymous.id });
        const customerLines = await manager
          .getRepository(CartLine)
          .findBy({ cartId: customer.id });
        const existing = new Map(
          customerLines.map((line) => [line.variantId, line]),
        );
        if (
          new Set([
            ...customerLines.map((line) => line.variantId),
            ...anonymousLines.map((line) => line.variantId),
          ]).size > MAX_LINES
        ) {
          throw new CartError(
            'cart.merge_conflict',
            'ترکیب دو سبد از محدودیت تعداد کالا بیشتر می‌شود.',
          );
        }
        for (const line of anonymousLines) {
          const target = existing.get(line.variantId);
          if (target) {
            if (target.quantity + line.quantity > MAX_QUANTITY) {
              throw new CartError(
                'cart.merge_conflict',
                'تعداد یکی از کالاها پس از ترکیب بیش از حد مجاز می‌شود.',
              );
            }
            target.quantity += line.quantity;
            await manager.save(target);
          } else {
            line.cartId = customer.id;
            await manager.save(line);
          }
        }
        anonymous.status = CartStatus.MERGED;
        anonymous.terminalAt = new Date();
        anonymous.successorCartId = customer.id;
        anonymous.anonymousTokenDigest = null;
        await manager.save(anonymous);
        await this.bump(manager, customer);
      }

      await manager.save(
        manager.create(CartClaim, {
          anonymousTokenDigest: anonymousTokenDigests[0],
          userId,
          cartId: customer.id,
          expiresAt: new Date(Date.now() + this.configuration.claimReplayTtlMs),
        }),
      );
      return this.view(manager, customer);
    });
  }

  async lockForCheckout(
    userId: string,
    cartId: string,
    expectedVersion: number,
    transaction: DatabaseTransactionContext,
  ): Promise<CheckoutCart> {
    const cart = await this.persistence.lockActiveCustomerCart(
      userId,
      cartId,
      transaction,
    );
    if (!cart || this.isExpired(cart)) {
      throw new CartError('cart.not_found', 'سبد خرید فعال پیدا نشد.');
    }
    this.assertVersion(cart, expectedVersion);
    const lines = await this.persistence.listLines(cartId, transaction);
    if (!lines.length) {
      throw new CartError('cart.line_invalid', 'سبد خرید خالی است.');
    }
    return {
      cartId,
      version: cart.version,
      lines: lines.map(({ variantId, quantity }) => ({ variantId, quantity })),
    };
  }

  async completeCheckout(
    cartId: string,
    expectedVersion: number,
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    const result = await this.persistence.complete(
      cartId,
      expectedVersion,
      transaction,
    );
    if (result.affected !== 1) this.versionConflict(expectedVersion);
  }

  private async mutateExisting(
    owner: CartOwner,
    expectedVersion: number,
    operation: (manager: EntityManager, cart: Cart) => Promise<void>,
  ): Promise<CartView> {
    return this.dataSource.transaction(async (manager) => {
      const cart = await this.findActive(manager, owner, true);
      if (!cart || this.isExpired(cart)) {
        if (cart) await this.expire(manager, cart);
        throw new CartError('cart.not_found', 'سبد خرید فعال پیدا نشد.');
      }
      this.assertVersion(cart, expectedVersion);
      await operation(manager, cart);
      await this.bump(manager, cart);
      return this.view(manager, cart);
    });
  }

  private async findActive(
    manager: EntityManager,
    owner: CartOwner,
    lock: boolean,
    tokenDigests?: readonly string[],
  ): Promise<Cart | null> {
    const query = manager
      .getRepository(Cart)
      .createQueryBuilder('cart')
      .where('cart.status = :status', { status: CartStatus.ACTIVE });
    if (owner.userId) {
      query.andWhere('cart.user_id = :userId', { userId: owner.userId });
    } else {
      const digests = tokenDigests ??
        owner.anonymousTokenDigests ?? [owner.anonymousTokenDigest];
      const valid = digests.filter((value): value is string => Boolean(value));
      if (!valid.length) return null;
      query
        .andWhere('cart.user_id IS NULL')
        .andWhere('cart.anonymous_token_digest IN (:...digests)', {
          digests: valid,
        });
    }
    if (lock) query.setLock('pessimistic_write');
    return query.getOne();
  }

  private async view(manager: EntityManager, cart: Cart): Promise<CartView> {
    const lines = await manager.getRepository(CartLine).find({
      where: { cartId: cart.id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const variantIds = lines.map((line) => line.variantId);
    const [facts, prices, availability] = await Promise.all([
      this.catalog.getVariantSnapshotFacts(variantIds),
      this.pricing.readPublicVariantPrices(variantIds),
      this.inventory.readPublicVariantAvailability(variantIds),
    ]);
    const factByVariant = new Map(facts.map((fact) => [fact.variantId, fact]));
    const priceByVariant = new Map(
      prices.map((price) => [price.variantId, price.unitPrice]),
    );
    const availabilityByVariant = new Map(
      availability.map((item) => [item.variantId, item.availability]),
    );
    return {
      id: cart.id,
      version: cart.version,
      status: 'active',
      expiresAt: cart.expiresAt,
      lines: lines.map(({ id, variantId, quantity }) => {
        const fact = factByVariant.get(variantId);
        const price = priceByVariant.get(variantId);
        const state = availabilityByVariant.get(variantId) ?? 'unavailable';
        return {
          id,
          variantId,
          quantity,
          productTitle: fact?.productTitle ?? null,
          variantTitle: fact?.variantTitle ?? null,
          price: price ? formatMoney(price) : null,
          availability: state,
          purchasable:
            fact?.productStatus === 'published' &&
            fact.variantStatus === 'active' &&
            Boolean(price) &&
            state === 'in_stock',
        };
      }),
    };
  }

  private empty(): CartView {
    return {
      id: null,
      version: 0,
      status: 'active',
      expiresAt: null,
      lines: [],
    };
  }

  private assertVersion(cart: Cart, expected: number): void {
    if (cart.version !== expected) this.versionConflict(cart.version);
  }

  private versionConflict(currentVersion: number): never {
    throw new CartError(
      'cart.version_conflict',
      'سبد خرید در جای دیگری تغییر کرده است. دوباره تلاش کنید.',
      currentVersion,
    );
  }

  private async bump(manager: EntityManager, cart: Cart): Promise<void> {
    cart.version += 1;
    cart.expiresAt = this.expiry(Boolean(cart.userId));
    await manager.save(cart);
  }

  private async expire(manager: EntityManager, cart: Cart): Promise<void> {
    cart.status = CartStatus.EXPIRED;
    cart.terminalAt = new Date();
    cart.anonymousTokenDigest = null;
    await manager.save(cart);
  }

  private isExpired(cart: Cart): boolean {
    return cart.expiresAt.getTime() <= Date.now();
  }

  private expiry(authenticated: boolean): Date {
    return new Date(
      Date.now() +
        (authenticated
          ? this.configuration.customerTtlMs
          : this.configuration.anonymousTtlMs),
    );
  }
}
