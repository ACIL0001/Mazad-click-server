/**
 * Masks an IPv4 address to /24 subnet for GDPR compliance.
 * Example: "197.112.45.67" → "197.112.45.0"
 *
 * For IPv6 addresses, masks the last 80 bits.
 */
export function maskIpAddress(ip: string): string {
  if (!ip || ip === '::1' || ip === '127.0.0.1') {
    return '127.0.0.0';
  }

  // Handle IPv4
  const ipv4Match = ip.match(/(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}/);
  if (ipv4Match) {
    return `${ipv4Match[1]}.0`;
  }

  // Handle IPv4-mapped IPv6 (::ffff:192.168.1.1)
  const mappedIpv4 = ip.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}/i);
  if (mappedIpv4) {
    return `${mappedIpv4[1]}.0`;
  }

  // Handle pure IPv6 — mask last 5 groups
  const ipv6Parts = ip.split(':');
  if (ipv6Parts.length > 3) {
    return ipv6Parts.slice(0, 3).join(':') + ':0:0:0:0:0';
  }

  return '0.0.0.0';
}
