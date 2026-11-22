export type HostKind =
  | { kind: "root" }
  | { kind: "admin" }
  | { kind: "tenant"; slug: string }
  | { kind: "other" };

const SLUG_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;
const SYSTEM_LABELS = new Set(["www", "admin", "api"]);

/** Interpreta el header Host. `rootDomain` es mishowo.com en prod y localhost en desarrollo. */
export function tenantFromHost(hostHeader: string | null | undefined, rootDomain: string): HostKind {
  if (!hostHeader) return { kind: "other" };
  const host = hostHeader.toLowerCase().split(":")[0]!.replace(/\.$/, "");
  const root = rootDomain.toLowerCase();
  if (host === root || host === `www.${root}`) return { kind: "root" };
  if (host === `admin.${root}`) return { kind: "admin" };
  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, -(root.length + 1));
    if (label.includes(".") || SYSTEM_LABELS.has(label) || !SLUG_LABEL.test(label)) return { kind: "other" };
    return { kind: "tenant", slug: label };
  }
  return { kind: "other" };
}
