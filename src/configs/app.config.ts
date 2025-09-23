import * as Joi from 'joi';

export enum ConfigKeys {
  NODE_ENV = 'NODE_ENV',
  PORT = 'PORT',

  // -- DATABASE
  DATABASE_URI = 'DATABASE_URI',
  DATABASE_NAME = 'DATABASE_NAME',

  // -- REDIS
  REDIS_HOST = 'REDIS_HOST',
  REDIS_PORT = 'REDIS_PORT',

  // -- API KEYS
  Client_API_KEY = 'Client_API_KEY',
  ADMIN_API_KEY = 'ADMIN_API_KEY',

  // -- SESSIONS
  SESSION_SECRET_KEY = 'SESSION_SECRET_KEY',

  // -- JWT
  JWT_SECRET_KEY = 'JWT_SECRET_KEY',

  // -- SLICKPAY
  SLICKPAY_PUBLIC_KEY = 'SLICKPAY_PUBLIC_KEY',
  SLICKPAY_SANDBOX = 'SLICKPAY_SANDBOX',
  SLICKPAY_BASE_URL = 'SLICKPAY_BASE_URL',

  // -- SATIM (CIB/Edahabia) Payment Gateway
  SATIM_MERCHANT_ID = 'SATIM_MERCHANT_ID',
  SATIM_TERMINAL_ID = 'SATIM_TERMINAL_ID',
  SATIM_MERCHANT_KEY = 'SATIM_MERCHANT_KEY',
  SATIM_BASE_URL = 'SATIM_BASE_URL',
  SATIM_SANDBOX = 'SATIM_SANDBOX',

  // -- CLIENT URL
  CLIENT_BASE_URL = 'CLIENT_BASE_URL',

  // -- CORS ORIGINS
  CORS_ORIGINS = 'CORS_ORIGINS',

  // -- INITIAL ADMIN ACCOUNT
  ADMIN_FIRSTNAME = 'ADMIN_FIRSTNAME',
  ADMIN_LASTNAME = 'ADMIN_LASTNAME',
  ADMIN_EMAIL = 'ADMIN_EMAIL',
  ADMIN_PASSWORD = 'ADMIN_PASSWORD',
  ADMIN_GENDER = 'ADMIN_GENDER',
  ADMIN_PHONE = 'ADMIN_PHONE',

  // -- INITIAL SOUS ADMIN ACCOUNT
  SOUS_ADMIN_FIRSTNAME = 'SOUS_ADMIN_FIRSTNAME',
  SOUS_ADMIN_LASTNAME = 'SOUS_ADMIN_LASTNAME',
  SOUS_ADMIN_EMAIL = 'SOUS_ADMIN_EMAIL',
  SOUS_ADMIN_PASSWORD = 'SOUS_ADMIN_PASSWORD',
  SOUS_ADMIN_GENDER = 'SOUS_ADMIN_GENDER',
  SOUS_ADMIN_PHONE = 'SOUS_ADMIN_PHONE',
}

export default () => {
  const keys = Object.values(ConfigKeys);

  const _config = {};
  for (const key of keys) {
    _config[key] = process.env[key];
  }

  return _config;
};

export enum ENVIRONMENT {
  DEVELLOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
  PREVISION = 'prevision',
}

export const validationSchema = Joi.object({
  [ConfigKeys.NODE_ENV]: Joi.string()
    .valid(...Object.values(ENVIRONMENT))
    .default('development'),
  [ConfigKeys.PORT]: Joi.number().port().default(3000),

  // -- DATABASE --
  [ConfigKeys.DATABASE_URI]: Joi.string().default('mongodb://localhost:27017/'),
  [ConfigKeys.DATABASE_NAME]: Joi.string().default('MazadClick'),

  // -- REDIS --
  [ConfigKeys.REDIS_HOST]: Joi.string().default('localhost'),
  [ConfigKeys.REDIS_PORT]: Joi.number().default(6379),

  // -- API KEYS --
  [ConfigKeys.Client_API_KEY]: Joi.string().required(),
  [ConfigKeys.ADMIN_API_KEY]: Joi.string().required(),

  // -- SESSIONS --
  [ConfigKeys.SESSION_SECRET_KEY]: Joi.string().required(),
  [ConfigKeys.JWT_SECRET_KEY]: Joi.string().required(),

  // -- SLICKPAY --
  [ConfigKeys.SLICKPAY_PUBLIC_KEY]: Joi.string().optional(),
  [ConfigKeys.SLICKPAY_SANDBOX]: Joi.boolean().default(true),
  [ConfigKeys.SLICKPAY_BASE_URL]: Joi.string().default('https://satim.slick-pay.com/'),

  // -- SATIM (CIB/Edahabia) Payment Gateway --
  [ConfigKeys.SATIM_MERCHANT_ID]: Joi.string().optional(),
  [ConfigKeys.SATIM_TERMINAL_ID]: Joi.string().optional(),
  [ConfigKeys.SATIM_MERCHANT_KEY]: Joi.string().optional(),
  [ConfigKeys.SATIM_BASE_URL]: Joi.string().default('https://api.satim.com/'),
  [ConfigKeys.SATIM_SANDBOX]: Joi.boolean().default(true),

  // -- CLIENT URL --
  [ConfigKeys.CLIENT_BASE_URL]: Joi.string().default('http://localhost:3003'),

  // -- CORS ORIGINS --
  [ConfigKeys.CORS_ORIGINS]: Joi.string().optional(),

  // -- ADMIN ACCOUNT --
  [ConfigKeys.ADMIN_FIRSTNAME]: Joi.string().required(),
  [ConfigKeys.ADMIN_LASTNAME]: Joi.string().required(),
  [ConfigKeys.ADMIN_EMAIL]: Joi.string().email().required(),
  [ConfigKeys.ADMIN_PASSWORD]: Joi.string().required(),
  [ConfigKeys.ADMIN_PHONE]: Joi.string().required(),

  // -- SOUS ADMIN ACCOUNT --
  [ConfigKeys.SOUS_ADMIN_FIRSTNAME]: Joi.string().required(),
  [ConfigKeys.SOUS_ADMIN_LASTNAME]: Joi.string().required(),
  [ConfigKeys.SOUS_ADMIN_EMAIL]: Joi.string().email().required(),
  [ConfigKeys.SOUS_ADMIN_PASSWORD]: Joi.string().required(),
  [ConfigKeys.SOUS_ADMIN_PHONE]: Joi.string().required(),
});
