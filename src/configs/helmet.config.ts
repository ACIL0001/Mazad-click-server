import helmet from 'helmet';

const helmetConfig = helmet({
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: [
        "'self'",
        'data:',
        // 'http://localhost:3000', // Development backend images
        'https://mazadclick-server.onrender.com', // Production backend images
        'https://api.mazad.click', // Legacy production API images
        'https://mazadclick-server.onrender.com', // Current production API images (Render.com)
        'https://*.onrender.com', // Allow all Render.com subdomains
        'https:', // Allow all HTTPS images (needed for CDNs and external images)
      ],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
  // --- ADD THIS LINE FOR CROSS-ORIGIN-RESOURCE-POLICY ---
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images from other origins
  // --- END ADDITION ---
});

export default helmetConfig;
