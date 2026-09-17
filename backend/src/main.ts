import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import type { AppConfig } from './config/configuration.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth/auth-cookie.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = configService.getOrThrow<number>('port');
  const corsOrigin = configService.getOrThrow<AppConfig['corsOrigin']>(
    'corsOrigin',
  );
  const trustProxy = configService.getOrThrow<boolean>('trustProxy');

  if (trustProxy) {
    const expressApp = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: number) => void;
    };
    expressApp.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
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

  const nodeEnv = configService.getOrThrow<string>('nodeEnv');

  const swaggerBuilder = new DocumentBuilder()
    .setTitle('Auth API')
    .setDescription('Sign up, sign in, and protected user endpoints')
    .setVersion('1.0')
    .addCookieAuth(ACCESS_TOKEN_COOKIE)
    .addCookieAuth(REFRESH_TOKEN_COOKIE, { type: 'apiKey', in: 'cookie' }, 'refresh_token');

  if (nodeEnv === 'production') {
    swaggerBuilder.addServer('/api');
  }

  const swaggerConfig = swaggerBuilder.build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`Application listening on http://localhost:${port}`);
  if (nodeEnv === 'production') {
    logger.log('Swagger docs at http://localhost:8080/api/docs/ (via nginx)');
  } else {
    logger.log(`Swagger docs at http://localhost:${port}/docs`);
  }
}

await bootstrap();
