import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { DevelopmentAccountBootstrapService } from '../../identity';
import { OwnerBootstrapService } from './owner-bootstrap.service';

const EMAIL_KEY = 'DEV_OWNER_EMAIL';
const PASSWORD_KEY = 'DEV_OWNER_PASSWORD';

export async function runDevelopmentOwnerBootstrapCommand(): Promise<number> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const email = process.env[EMAIL_KEY]?.trim();
    const password = process.env[PASSWORD_KEY];
    if (!email || !password) {
      console.error(
        `Development owner bootstrap requires ${EMAIL_KEY} and ${PASSWORD_KEY}.`,
      );
      return 2;
    }

    const account = await app
      .get(DevelopmentAccountBootstrapService)
      .createIfMissing(email, password);
    const owner = await app
      .get(OwnerBootstrapService)
      .bootstrap(account.emailNormalized);

    if (account.created) {
      console.log('Development owner account created and activated.');
    } else if (owner.changed) {
      console.log('Existing development account promoted to owner.');
    } else {
      console.log('Development owner is already available.');
    }
    return 0;
  } catch {
    // Credentials, email addresses, database details, and internal errors must
    // not be reflected into terminal output.
    console.error(
      'Development owner bootstrap failed. Check configuration and service logs.',
    );
    return 1;
  } finally {
    await app.close();
  }
}

if (process.argv[1]?.includes('development-owner-bootstrap.cli')) {
  void runDevelopmentOwnerBootstrapCommand().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
