import {
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration.js';
import { envValidationSchema } from './config/env.validation.js';
import { LoggerMiddleware } from './common/middleware/logger.middleware.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('Mongoose');
        return {
          uri: configService.getOrThrow<string>('mongodbUri'),
          connectionFactory: (connection: {
            on: (event: string, listener: () => void) => void;
          }) => {
            connection.on('connected', () => {
              logger.log('MongoDB connected');
            });
            connection.on('error', () => {
              logger.error('MongoDB connection error');
            });
            return connection;
          },
        };
      },
    }),
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
