export const FORBIDDEN_OFFER_DOMAIN_IMPORT_PREFIXES = Object.freeze([
  "@/app/",
  "@/components/",
  "@/lib/application-intake/",
  "@/lib/application-server",
] as const);

export function assertOfferDomainImportBoundary(source: string, filename: string): true {
  const importedSpecifiers = Array.from(
    source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/gu),
    (match) => match[1],
  );
  for (const specifier of importedSpecifiers) {
    for (const prefix of FORBIDDEN_OFFER_DOMAIN_IMPORT_PREFIXES) {
      if (specifier.startsWith(prefix)) {
        throw new Error(`${filename} imports forbidden consumer boundary ${prefix}.`);
      }
    }
  }
  return true;
}
