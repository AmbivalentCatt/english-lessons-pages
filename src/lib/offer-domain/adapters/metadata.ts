import { CURRENT_PUBLIC_CLAIMS } from "../catalog/current-public-claims";

export function offerDomainMetadataDescription(legacyDescription: string, enabled: boolean): string {
  return enabled ? CURRENT_PUBLIC_CLAIMS.audience : legacyDescription;
}
