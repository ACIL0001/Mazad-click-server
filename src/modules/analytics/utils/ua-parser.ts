/**
 * Lightweight User-Agent parser for analytics.
 * Extracts browser name, OS, and device type from the UA string.
 * Uses ua-parser-js for reliable parsing.
 */

interface ParsedUA {
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
}

/**
 * Parse a User-Agent string without external dependencies.
 * Provides a lightweight built-in parser as fallback.
 */
export function parseUserAgent(ua: string): ParsedUA {
  if (!ua) {
    return { browser: 'Unknown', os: 'Unknown', deviceType: 'desktop' };
  }

  const lowerUA = ua.toLowerCase();

  // ── Device Type Detection ──
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (
    /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|bb10|opera mini|opera mobi/i.test(ua)
  ) {
    deviceType = 'mobile';
  }

  // ── Browser Detection ──
  let browser = 'Unknown';
  if (lowerUA.includes('edg/')) {
    const match = ua.match(/Edg\/(\d+)/);
    browser = `Edge ${match?.[1] || ''}`.trim();
  } else if (lowerUA.includes('opr/') || lowerUA.includes('opera')) {
    const match = ua.match(/(?:OPR|Opera)\/(\d+)/i);
    browser = `Opera ${match?.[1] || ''}`.trim();
  } else if (lowerUA.includes('chrome/') && !lowerUA.includes('chromium')) {
    const match = ua.match(/Chrome\/(\d+)/);
    browser = `Chrome ${match?.[1] || ''}`.trim();
  } else if (lowerUA.includes('firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/);
    browser = `Firefox ${match?.[1] || ''}`.trim();
  } else if (lowerUA.includes('safari/') && !lowerUA.includes('chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    browser = `Safari ${match?.[1] || ''}`.trim();
  } else if (lowerUA.includes('msie') || lowerUA.includes('trident')) {
    browser = 'IE';
  }

  // ── OS Detection ──
  let os = 'Unknown';
  if (lowerUA.includes('windows nt 10')) os = 'Windows 10+';
  else if (lowerUA.includes('windows nt 6.3')) os = 'Windows 8.1';
  else if (lowerUA.includes('windows nt 6.1')) os = 'Windows 7';
  else if (lowerUA.includes('windows')) os = 'Windows';
  else if (lowerUA.includes('mac os x')) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    os = `macOS ${match?.[1]?.replace(/_/g, '.') || ''}`.trim();
  } else if (lowerUA.includes('android')) {
    const match = ua.match(/Android (\d+\.?\d*)/);
    os = `Android ${match?.[1] || ''}`.trim();
  } else if (lowerUA.includes('iphone os') || lowerUA.includes('ipad')) {
    const match = ua.match(/OS (\d+[._]\d+)/);
    os = `iOS ${match?.[1]?.replace(/_/g, '.') || ''}`.trim();
  } else if (lowerUA.includes('linux')) os = 'Linux';
  else if (lowerUA.includes('cros')) os = 'Chrome OS';

  return { browser, os, deviceType };
}
