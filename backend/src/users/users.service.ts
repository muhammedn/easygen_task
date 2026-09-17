import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema.js';

export type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(input: CreateUserInput): Promise<UserDocument> {
    const user = new this.userModel(input);
    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async recordFailedLogin(
    id: string,
    maxAttempts: number,
    lockMs: number,
  ): Promise<void> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        id,
        { $inc: { failedLoginAttempts: 1 } },
        { returnDocument: 'after' },
      )
      .exec();

    if (updated && updated.failedLoginAttempts >= maxAttempts) {
      await this.userModel
        .findByIdAndUpdate(id, {
          $set: {
            lockUntil: new Date(Date.now() + lockMs),
            failedLoginAttempts: 0,
          },
        })
        .exec();
    }
  }

  async resetLoginFailures(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        $set: { failedLoginAttempts: 0, lockUntil: null },
      })
      .exec();
  }

  async bumpTokenVersion(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } })
      .exec();
  }
}
