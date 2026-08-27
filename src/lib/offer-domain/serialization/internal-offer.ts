import type { AvailabilitySnapshot } from "../types";
import { PRIVATE_LOYALTY_POLICY } from "../policies/discounts";
import { PRIVATE_PRO_SUPPORT_POLICY } from "../policies/support";
import { serializePublicOffer } from "./public-offer";

export function serializeInternalOffer(snapshot: AvailabilitySnapshot, now: string) {
  return Object.freeze({
    publicOffer: serializePublicOffer(snapshot, now),
    privatePolicies: Object.freeze({
      loyalty: PRIVATE_LOYALTY_POLICY,
      proSupportPlanning: PRIVATE_PRO_SUPPORT_POLICY,
    }),
  });
}
