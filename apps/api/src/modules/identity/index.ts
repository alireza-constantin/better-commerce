export { IdentityModule } from './identity.module';
export {
  IDENTITY_ADMINISTRATION,
  type IdentityAdministration,
  type IdentityLockResult,
  type IdentityReference,
  type IdentitySummary,
} from './identity-administration.contract';
export { SessionAuthGuard } from './auth/session-auth.guard';
export { normalizeIranianMobile } from './auth/mobile-normalization';
export {
  MobileOtpChallenge,
  MobileOtpChallengeStatus,
} from './persistence/mobile-otp-challenge.entity';
export {
  DevelopmentAccountBootstrapService,
  type DevelopmentAccountBootstrapResult,
} from './auth/development-account-bootstrap.service';
export type { AuthenticatedUser } from './auth/auth.types';
