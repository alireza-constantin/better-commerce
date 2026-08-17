import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'node:crypto';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';
import { CommunicationsService } from '../../communications/communications.service';
import {
  CustomerProfile,
  CustomerProfileStatus,
} from '../../customers/customer-profile.entity';
import { PasswordCredential } from '../persistence/password-credential.entity';
import {
  MobileOtpChallenge,
  MobileOtpChallengeStatus,
} from '../persistence/mobile-otp-challenge.entity';
import { User, UserStatus } from '../persistence/user.entity';
import { SessionService } from '../session';
import { PasswordService } from './password.service';
import { normalizeIranianMobile } from './mobile-normalization';
import { toSafeUser } from './auth.service';

export interface MobileRegistrationInput {
  readonly displayName: string;
  readonly mobile: string;
  readonly email?: string;
  readonly password?: string;
}

export interface MobileRegistrationResult {
  readonly userId: string;
  readonly challengeId: string;
  readonly mobile: string;
  readonly status: 'pending';
  readonly testCode?: string;
}

export interface VerifyMobileInput {
  readonly challengeId: string;
  readonly code: string;
}

export interface MobileLoginChallengeResult {
  readonly challengeId: string;
  readonly mobile: string;
  readonly status: 'pending';
  readonly testCode?: string;
}

@Injectable()
export class MobileRegistrationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(MobileOtpChallenge)
    private readonly challenges: Repository<MobileOtpChallenge>,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly communications: CommunicationsService,
  ) {}

  async register(
    input: MobileRegistrationInput,
  ): Promise<MobileRegistrationResult> {
    const mobile = normalizeIranianMobile(input.mobile);
    const displayName = input.displayName.trim();
    if (displayName.length < 2 || displayName.length > 120) {
      throw new BadRequestException('Enter a display name between 2 and 120 characters');
    }
    if (input.email && !input.password) {
      throw new BadRequestException('A password is required when an email is provided');
    }
    if (!input.email && input.password) {
      throw new BadRequestException('A password requires an email address');
    }

    const code = String(randomInt(100000, 1000000));
    const challenge = await this.dataSource.transaction(async (manager) => {
      const txUsers = manager.getRepository(User);
      const txProfiles = manager.getRepository(CustomerProfile);
      const txChallenges = manager.getRepository(MobileOtpChallenge);
      const existing = await txUsers.findOne({ where: { mobileNormalized: mobile } });
      if (existing) throw new ConflictException('This mobile number is already registered');

      const email = input.email?.trim() || null;
      const emailNormalized = email ? email.normalize('NFKC').toLowerCase() : null;
      if (emailNormalized) {
        const existingEmail = await txUsers.findOne({ where: { emailNormalized } });
        if (existingEmail) throw new ConflictException('This email is already registered');
      }
      const user = await txUsers.save(
        txUsers.create({
          email,
          emailNormalized,
          mobile,
          mobileNormalized: mobile,
          mobileVerifiedAt: null,
          status: UserStatus.PENDING,
          authVersion: 0,
          emailVerifiedAt: null,
        }),
      );
      await txProfiles.save(
        txProfiles.create({
          userId: user.id,
          displayName,
          status: CustomerProfileStatus.PENDING,
        }),
      );
      if (input.password) {
        const txCredentials = manager.getRepository(PasswordCredential);
        await txCredentials.save(
          txCredentials.create({
            userId: user.id,
            passwordHash: await this.passwords.hash(input.password),
            passwordChangedAt: new Date(),
          }),
        );
      }
      return txChallenges.save(
        txChallenges.create({
          mobileNormalized: mobile,
          userId: user.id,
          codeDigest: this.digest(code),
          status: MobileOtpChallengeStatus.PENDING,
          attemptCount: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 5 * 60_000),
          consumedAt: null,
        }),
      );
    }).catch((error) => {
      if (error instanceof ConflictException) throw error;
      throw error;
    });

    await this.communications.queueAuthenticationOtp(mobile, code);
    return {
      userId: (await this.users.findOneByOrFail({ mobileNormalized: mobile })).id,
      challengeId: challenge.id,
      mobile,
      status: 'pending',
      ...(process.env.NODE_ENV === 'test' ? { testCode: code } : {}),
    };
  }

  async verify(input: VerifyMobileInput, request: Request) {
    const challenge = await this.challenges.findOneBy({ id: input.challengeId });
    if (
      !challenge ||
      challenge.status !== MobileOtpChallengeStatus.PENDING ||
      challenge.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('The verification code is expired or invalid');
    }
    if (challenge.attemptCount >= challenge.maxAttempts) {
      challenge.status = MobileOtpChallengeStatus.LOCKED;
      await this.challenges.save(challenge);
      throw new UnauthorizedException('The verification code is expired or invalid');
    }
    challenge.attemptCount += 1;
    if (this.digest(input.code) !== challenge.codeDigest) {
      if (challenge.attemptCount >= challenge.maxAttempts) {
        challenge.status = MobileOtpChallengeStatus.LOCKED;
      }
      await this.challenges.save(challenge);
      throw new UnauthorizedException('The verification code is expired or invalid');
    }
    const user = await this.users.findOneBy({ mobileNormalized: challenge.mobileNormalized });
    if (!user || user.status !== UserStatus.PENDING) {
      throw new UnauthorizedException('The verification code is expired or invalid');
    }
    user.status = UserStatus.ACTIVE;
    user.mobileVerifiedAt = new Date();
    challenge.status = MobileOtpChallengeStatus.CONSUMED;
    challenge.consumedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).save(user);
      await manager.getRepository(MobileOtpChallenge).save(challenge);
      await manager.getRepository(CustomerProfile).update(
        { userId: user.id },
        { status: CustomerProfileStatus.ACTIVE },
      );
    });
    await this.sessions.establishAuthenticatedSession(request, {
      userId: user.id,
      authVersion: user.authVersion,
      authenticationMethod: 'mobile_otp',
    });
    return toSafeUser(user);
  }

  async requestLoginOtp(mobileInput: string): Promise<MobileLoginChallengeResult> {
    const mobile = normalizeIranianMobile(mobileInput);
    const user = await this.users.findOneBy({ mobileNormalized: mobile });
    if (!user || user.status !== UserStatus.ACTIVE || !user.mobileVerifiedAt) {
      throw new UnauthorizedException('Invalid mobile number');
    }
    const code = String(randomInt(100000, 1000000));
    const challenge = await this.challenges.save(
      this.challenges.create({
        mobileNormalized: mobile,
        userId: user.id,
        codeDigest: this.digest(code),
        status: MobileOtpChallengeStatus.PENDING,
        attemptCount: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60_000),
        consumedAt: null,
      }),
    );
    await this.communications.queueAuthenticationOtp(mobile, code);
    return {
      challengeId: challenge.id,
      mobile,
      status: 'pending',
      ...(process.env.NODE_ENV === 'test' ? { testCode: code } : {}),
    };
  }

  async verifyLoginOtp(input: VerifyMobileInput, request: Request) {
    const challenge = await this.challenges.findOneBy({ id: input.challengeId });
    if (
      !challenge ||
      challenge.status !== MobileOtpChallengeStatus.PENDING ||
      challenge.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('The verification code is expired or invalid');
    }
    challenge.attemptCount += 1;
    if (this.digest(input.code) !== challenge.codeDigest) {
      if (challenge.attemptCount >= challenge.maxAttempts) {
        challenge.status = MobileOtpChallengeStatus.LOCKED;
      }
      await this.challenges.save(challenge);
      throw new UnauthorizedException('The verification code is expired or invalid');
    }
    const user = await this.users.findOneBy({ mobileNormalized: challenge.mobileNormalized });
    if (!user || user.status !== UserStatus.ACTIVE || !user.mobileVerifiedAt) {
      throw new UnauthorizedException('The verification code is expired or invalid');
    }
    challenge.status = MobileOtpChallengeStatus.CONSUMED;
    challenge.consumedAt = new Date();
    await this.challenges.save(challenge);
    await this.sessions.establishAuthenticatedSession(request, {
      userId: user.id,
      authVersion: user.authVersion,
      authenticationMethod: 'mobile_otp',
    });
    return toSafeUser(user);
  }

  async requestEnrollment(
    userId: string,
    mobileInput: string,
  ): Promise<MobileLoginChallengeResult> {
    const mobile = normalizeIranianMobile(mobileInput);
    const existing = await this.users.findOneBy({ mobileNormalized: mobile });
    if (existing && existing.id !== userId) {
      throw new ConflictException('This mobile number is already registered');
    }
    const user = await this.users.findOneBy({ id: userId });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException();
    }
    const code = String(randomInt(100000, 1000000));
    const challenge = await this.challenges.save(
      this.challenges.create({
        mobileNormalized: mobile,
        userId,
        codeDigest: this.digest(code),
        status: MobileOtpChallengeStatus.PENDING,
        attemptCount: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60_000),
        consumedAt: null,
      }),
    );
    await this.communications.queueAuthenticationOtp(mobile, code);
    return {
      challengeId: challenge.id,
      mobile,
      status: 'pending',
      ...(process.env.NODE_ENV === 'test' ? { testCode: code } : {}),
    };
  }

  async verifyEnrollment(input: VerifyMobileInput, userId: string) {
    const challenge = await this.challenges.findOneBy({
      id: input.challengeId,
      userId,
    });
    if (
      !challenge ||
      challenge.status !== MobileOtpChallengeStatus.PENDING ||
      challenge.expiresAt.getTime() <= Date.now() ||
      this.digest(input.code) !== challenge.codeDigest
    ) {
      throw new UnauthorizedException('The verification code is expired or invalid');
    }
    const user = await this.users.findOneBy({ id: userId });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();
    user.mobile = challenge.mobileNormalized;
    user.mobileNormalized = challenge.mobileNormalized;
    user.mobileVerifiedAt = new Date();
    challenge.status = MobileOtpChallengeStatus.CONSUMED;
    challenge.consumedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).save(user);
      await manager.getRepository(MobileOtpChallenge).save(challenge);
    });
    return toSafeUser(user);
  }

  private digest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
