import type { DeliveryAddress } from '../shipping';
import type { ManualPaymentMethod, ManualPaymentStatus } from '../payments';
import type { FulfillmentClassification } from '../catalog';
import { CommerceOrderStatus } from './commerce-order.entity';

export interface SubmitOrderInput {
  readonly lines: readonly { variantId: string; quantity: number }[];
  readonly shippingMethodId: string;
  readonly paymentMethod: ManualPaymentMethod;
  readonly deliveryAddress: DeliveryAddress;
  readonly promotionCode?: string | null;
}

export interface SubmitCartOrderInput {
  readonly cartId: string;
  readonly cartVersion: number;
  readonly shippingMethodId: string;
  readonly paymentMethod: ManualPaymentMethod;
  readonly deliveryAddress: DeliveryAddress;
  readonly promotionCode?: string | null;
}

export interface OrderLineView {
  readonly productId: string;
  readonly variantId: string;
  readonly productTitle: string;
  readonly variantTitle: string | null;
  readonly sku: string | null;
  readonly fulfillmentClassification: FulfillmentClassification;
  readonly quantity: number;
  readonly priceVersionId: string;
  readonly unitAmount: string;
  readonly lineAmount: string;
}

export interface OrderView {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: CommerceOrderStatus;
  readonly currency: string;
  readonly merchandiseSubtotal: string;
  readonly discountTotal: string;
  readonly shippingAmount: string;
  readonly grandTotal: string;
  readonly paymentMethod: ManualPaymentMethod;
  readonly paymentStatus: ManualPaymentStatus;
  readonly shippingMethodTitle: string;
  readonly deliveryAddress: DeliveryAddress;
  readonly submittedAt: Date;
  readonly acceptedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly lines: readonly OrderLineView[];
}

export interface OrderListView {
  readonly items: readonly OrderView[];
  readonly nextCursor: string | null;
}
