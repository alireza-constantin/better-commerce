import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { EmailVerificationController } from './auth/email-verification.controller';
import { EmailVerificationService } from './auth/email-verification.service';
import { PasswordService } from './auth/password.service';
import { DevelopmentAccountBootstrapService } from './auth/development-account-bootstrap.service';
import { SessionAuthGuard } from './auth/session-auth.guard';
import { IDENTITY_ADMINISTRATION } from './identity-administration.contract';
import { IdentityAdministrationPersistence } from './persistence/identity-administration.persistence';
import { EmailVerificationToken } from './persistence/email-verification-token.entity';
import { PasswordCredential } from './persistence/password-credential.entity';
import { User } from './persistence/user.entity';
import { MobileOtpChallenge } from './persistence/mobile-otp-challenge.entity';
import { SessionModule } from './session';
import { SecurityModule } from '../../platform/security';
import { CustomersModule } from '../customers';
import { CommunicationsModule } from '../communications/communications.module';
import { MobileRegistrationService } from './auth/mobile-registration.service';

@Module({
  imports: [
    ConfigModule,
    SessionModule,
    SecurityModule,
    CustomersModule,
    CommunicationsModule,
    TypeOrmModule.forFeature([
      User,
      PasswordCredential,
      EmailVerificationToken,
      MobileOtpChallenge,
    ]),
  ],
  controllers: [AuthController, EmailVerificationController],
  providers: [
    AuthService,
    PasswordService,
    DevelopmentAccountBootstrapService,
    SessionAuthGuard,
    EmailVerificationService,
    MobileRegistrationService,
    IdentityAdministrationPersistence,
    {
      provide: IDENTITY_ADMINISTRATION,
      useExisting: IdentityAdministrationPersistence,
    },
  ],
  exports: [
    SessionAuthGuard,
    IDENTITY_ADMINISTRATION,
    DevelopmentAccountBootstrapService,
  ],
})
export class IdentityModule {}
