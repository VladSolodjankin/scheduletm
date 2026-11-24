/** A page owner's own domain: the status the owner sees and the address their DNS has to point to. */
export type PublicPageDomain = {
  domain: string;
  verified: boolean;
  /** Host name the domain's DNS records have to point to. */
  target: string;
};

const hostLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Lower-cased host name of a domain a page can be served from, or null when the input is not one. */
export function normalizePublicPageDomain(value: string): string | null {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (domain.length > 253) return null;
  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every((label) => hostLabel.test(label))) return null;
  if (/^\d+$/.test(labels[labels.length - 1]!)) return null;
  return domain;
}
