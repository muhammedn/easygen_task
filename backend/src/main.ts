import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import type { AppConfig } from './config/configuration.js';
import { ACCESS_TOKEN_COOKIE } from './auth/auth-cookie.js';

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Auth API')
    .setDescription('Sign up, sign in, and protected user endpoints')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the JWT from signup or signin',
      },
      'access-token',
    )
    .addCookieAuth(ACCESS_TOKEN_COOKIE)
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`Application listening on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
}

await bootstrap();
