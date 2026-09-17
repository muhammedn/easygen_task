import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import ms, { type StringValue } from 'ms';
import { Model, Types } from 'mongoose';
import {
  RefreshSession,
  type RefreshSessionDocument,
} from './schemas/refresh-session.schema.js';

export type IssuedRefreshToken = {
  token: string;
  session: RefreshSessionDocument;
};

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectModel(RefreshSession.name)
    private readonly refreshSessionModel: Model<RefreshSessionDocument>,
    private readonly configService: ConfigService,
  ) {}

  async issue(userId: string, familyId?: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(token);
    const resolvedFamilyId = familyId ?? randomUUID();
    const ttl = this.getRefreshTtlMs();

    const session = await this.refreshSessionModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash,
      familyId: resolvedFamilyId,
      expiresAt: new Date(Date.now() + ttl),
      revokedAt: null,
    });

    return { token, session };
  }

  async findByToken(token: string): Promise<RefreshSessionDocument | null> {
    return this.refreshSessionModel
      .findOne({ tokenHash: this.hash(token) })
      .exec();
  }

  /**
   * Atomically claims an active session (revokedAt: null) then issues a
   * replacement in the same family. Returns null if another request already
   * claimed it (concurrent refresh).
   */
  async rotate(
    session: RefreshSessionDocument,
  ): Promise<IssuedRefreshToken | null> {
    const claimed = await this.refreshSessionModel
      .findOneAndUpdate(
        { _id: session._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();

    if (!claimed) {
      return null;
    }

    return this.issue(session.userId.toString(), session.familyId);
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.refreshSessionModel
      .updateMany(
        { familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshSessionModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTtlMs(): number {
    const expiresIn = this.configService.getOrThrow<string>(
      'refreshTokenExpiresIn',
    );
    const ttl = ms(expiresIn as StringValue);
    if (typeof ttl !== 'number') {
      throw new Error(`Invalid REFRESH_TOKEN_EXPIRES_IN value: ${expiresIn}`);
    }
    return ttl;
  }
}
