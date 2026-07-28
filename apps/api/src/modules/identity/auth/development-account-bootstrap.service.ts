import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { isEmail } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import type { ApplicationConfiguration } from '../../../platform/config';
import { PasswordCredential } from '../persistence/password-credential.entity';
import { User, UserStatus } from '../persistence/user.entity';
import { normalizeEmail } from './auth.service';
import { PasswordService } from './password.service';

export interface DevelopmentAccountBootstrapResult {
  readonly emailNormalized: string;
  readonly created: boolean;
}

/**
 * CLI-only development helper. It deliberately has no controller and refuses
 * to provision credentials unless the configured runtime is development.
 */
@Injectable()
export class DevelopmentAccountBootstrapService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<ApplicationConfiguration, true>,
  ) {}

  async createIfMissing(
    emailInput: string,
    password: string,
  ): Promise<DevelopmentAccountBootstrapResult> {
    if (this.config.get('environment', { infer: true }) !== 'development') {
      throw new Error(
        'Development account bootstrap is unavailable outside development',
      );
    }

    const email = emailInput.trim();
    const emailNormalized = normalizeEmail(emailInput);
    if (
      !isEmail(email, { allow_display_name: false, require_tld: true }) ||
      password.length < 12 ||
      password.length > 128
    ) {
      throw new Error('Invalid development owner credentials');
    }

    const existing = await this.users.findOne({
      where: { emailNormalized },
    });
    if (existing) {
      if (existing.status !== UserStatus.ACTIVE) {
        throw new ConflictException(
          'The development owner account is disabled',
        );
      }
      return { emailNormalized, created: false };
    }

    const passwordHash = await this.passwords.hash(password);
    await this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const credentials = manager.getRepository(PasswordCredential);
      const user = await users.save(
        users.create({
          email,
          emailNormalized,
          status: UserStatus.ACTIVE,
          authVersion: 0,
          emailVerifiedAt: null,
        }),
      );
      await credentials.save(
        credentials.create({
          userId: user.id,
          passwordHash,
          passwordChangedAt: new Date(),
        }),
      );
    });

    return { emailNormalized, created: true };
  }
}
