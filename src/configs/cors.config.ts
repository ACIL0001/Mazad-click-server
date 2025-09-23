import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// Get CORS origins from environment variable or use defaults
const getCorsOrigins = (): string[] => {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }
  
  // Default origins if no environment variable is set
  return [
  // Development URLs
  'http://localhost:3001', 
  'http://localhost:3002', 
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005', // Backoffice
  'http://localhost:3006',
  'http://localhost:3007',
  'http://localhost:3008',
  'http://localhost:3009',
  'http://localhost:3010',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:3004',
  'http://127.0.0.1:3005',
  'http://127.0.0.1:3006',
  'http://127.0.0.1:3007',
  'http://127.0.0.1:3008',
  'http://127.0.0.1:3009',
  'http://127.0.0.1:3010',
  'http://192.168.56.1:3001',
  'http://192.168.56.1:3002',
  'http://192.168.56.1:3003',
  'http://192.168.56.1:3004',
  'http://192.168.56.1:3005', // Backoffice
  'http://192.168.56.1:3006',
  'http://192.168.56.1:3007',
  'http://192.168.56.1:3008',
  'http://192.168.56.1:3009',
  'http://192.168.56.1:3010',
  // Production URLs - Main Domain
  'https://mazad.click',
  'https://www.mazad.click',
  // Production URLs - Vercel Deployments
  'https://mazad-click-buyer.vercel.app',
  'https://mazad-click-seller.vercel.app',
  'https://mazad-click-backoffice.vercel.app',
  'https://mazad-click-admin.vercel.app',
  // Additional Vercel URLs (in case of branch deployments)
  'https://mazad-click-buyer-git-main.vercel.app',
  'https://mazad-click-seller-git-main.vercel.app',
  'https://mazad-click-backoffice-git-main.vercel.app',
  'https://mazad-click-admin-git-main.vercel.app',
  // Render.com URLs (if you deploy there)
  'https://mazad-click-buyer.onrender.com',
  'https://mazad-click-seller.onrender.com',
  'https://mazad-click-backoffice.onrender.com',
  'https://mazad-click-admin.onrender.com',
  // Netlify URLs (if you deploy there)
  'https://mazad-click-buyer.netlify.app',
  'https://mazad-click-seller.netlify.app',
  'https://mazad-click-backoffice.netlify.app',
  'https://mazad-click-admin.netlify.app'
  ];
};

const allowedOrigins = getCorsOrigins();

const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    console.log('CORS Config Origin check:', origin);
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) {
      console.log('CORS Config: Allowing request with no origin');
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      console.log('CORS Config: Allowing origin:', origin);
      return callback(null, true);
    }
    console.log('CORS Config: Blocking origin:', origin);
    return callback(null, false); // Changed from Error to false
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-api-key', 'x-access-key'],
  preflightContinue: false,
};

export default corsConfig;
