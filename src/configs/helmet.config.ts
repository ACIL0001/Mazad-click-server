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
        'http://localhost:3000', // Still correctly allowing backend images
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
