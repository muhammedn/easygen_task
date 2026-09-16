import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import passportJwt from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';
import type { PublicUser } from '../../users/types/public-user.js';
import { ACCESS_TOKEN_COOKIE } from '../auth-cookie.js';
import type { JwtPayload } from '../types/auth-response.js';

const { ExtractJwt, Strategy } = passportJwt;

function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[ACCESS_TOKEN_COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwtSecret'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<PublicUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (payload.tv !== user.tokenVersion) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.usersService.toPublicUser(user);
  }
}
