import { assertCatalogInvariant } from "./catalog";
import { assertPricingInvariant } from "./pricing";

export function assertCoreOfferInvariants(): true {
  assertCatalogInvariant();
  assertPricingInvariant();
  return true;
}

export * from "./catalog";
export * from "./consumer-imports";
export * from "./consumer-parity";
export * from "./history";
export * from "./pricing";
export * from "./privacy";
