import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').optional(),
  TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
});
