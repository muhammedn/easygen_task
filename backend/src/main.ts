import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './auth/auth-cookie.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import type { AppConfig } from './config/configuration.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = configService.getOrThrow<number>('port');
  const corsOrigin =
    configService.getOrThrow<AppConfig['corsOrigin']>('corsOrigin');
  const trustProxy = configService.getOrThrow<boolean>('trustProxy');
  const nodeEnv = configService.getOrThrow<string>('nodeEnv');
  const isProduction = nodeEnv === 'production';

  if (trustProxy) {
    const expressApp = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: number) => void;
    };
    expressApp.set('trust proxy', 1);
  }

  // Swagger UI needs inline scripts; keep a relaxed CSP only outside production.
  // In production the API is JSON-only (Swagger disabled) and Helmet defaults apply.
  app.use(
    helmet(
      isProduction
        ? undefined
        : {
            contentSecurityPolicy: {
              directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
              },
            },
          },
    ),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Auth API')
      .setDescription('Sign up, sign in, and protected user endpoints')
      .setVersion('1.0')
      .addCookieAuth(ACCESS_TOKEN_COOKIE)
      .addCookieAuth(
        REFRESH_TOKEN_COOKIE,
        { type: 'apiKey', in: 'cookie' },
        'refresh_token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);
  logger.log(`Application listening on http://localhost:${port}`);
  if (!isProduction) {
    logger.log(`Swagger docs at http://localhost:${port}/docs`);
  }
}

await bootstrap();
