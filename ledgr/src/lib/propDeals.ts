/**
 * Your affiliate codes for prop firms: shown on the Prop firms page with a clear "Affiliate" label
 * and a disclosure, like other journals do. Only add codes you really have from each firm's own
 * affiliate program (and keep the link the firm gave you). Leave a firm out to show nothing.
 *
 * Example:
 *   "Lucid Trading": { code: "PAID", url: "https://lucidtrading.com/ref/paid", offer: "Up to 50% off" },
 */
export interface PropDeal {
  /** The discount code shoppers type at checkout. */
  code: string;
  /** Your affiliate (tracking) link from the firm. */
  url: string;
  /** What the code gives, as the firm states it (optional). */
  offer?: string;
}

export const PROP_DEALS: Record<string, PropDeal> = {};

export const hasDeals = () => Object.keys(PROP_DEALS).length > 0;
