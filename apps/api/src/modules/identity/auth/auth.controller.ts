import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AbuseProtectionInterceptor } from '../../../platform/security';
import {
  clearCookieOptions,
  SESSION_CONFIGURATION,
  type SessionConfiguration,
} from '../session';
import { AuthService } from './auth.service';
import { Public } from '../../../platform/http/authentication';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { SafeUserResponse } from './auth.types';
import { SafeUserResponseDto } from './dto/safe-user-response.dto';
import {
  ApiCsrfProtected,
  ApiSessionAuthenticated,
} from '../../../platform/openapi';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MobileRegistrationService } from './mobile-registration.service';

class MobileRegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName: string;

  @IsString()
  @MaxLength(24)
  mobile: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password?: string;
}

class VerifyMobileDto {
  @IsString()
  challengeId: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

class MobileLoginDto {
  @IsString()
  @MaxLength(24)
  mobile: string;
}

@ApiTags('Authentication')
@Controller('auth')
@UseInterceptors(new AbuseProtectionInterceptor())
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(SESSION_CONFIGURATION)
    private readonly sessionConfiguration: SessionConfiguration,
    private readonly mobileRegistration: MobileRegistrationService,
  ) {}

  @Public()
  @ApiOperation({ summary: 'Register with email and password' })
  @ApiCsrfProtected()
  @ApiCreatedResponse({ type: SafeUserResponseDto })
  @ApiConflictResponse({ description: 'The email is already registered.' })
  @ApiTooManyRequestsResponse({ description: 'Registration is throttled.' })
  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
  ): Promise<SafeUserResponse> {
    return this.auth.register(dto, request);
  }

  @Public()
  @ApiOperation({ summary: 'Start customer registration with an Iranian mobile number' })
  @ApiCsrfProtected()
  @ApiCreatedResponse()
  @Post('register/mobile')
  registerWithMobile(@Body() dto: MobileRegisterDto) {
    return this.mobileRegistration.register(dto);
  }

  @Public()
  @ApiOperation({ summary: 'Verify the mobile registration code' })
  @ApiCsrfProtected()
  @ApiOkResponse({ type: SafeUserResponseDto })
  @HttpCode(HttpStatus.OK)
  @Post('register/mobile/verify')
  verifyMobile(
    @Body() dto: VerifyMobileDto,
    @Req() request: Request,
  ): Promise<SafeUserResponse> {
    return this.mobileRegistration.verify(dto, request);
  }

  @Public()
  @ApiOperation({ summary: 'Send a mobile login code' })
  @ApiCsrfProtected()
  @ApiCreatedResponse()
  @Post('login/mobile/request')
  requestMobileLogin(@Body() dto: MobileLoginDto) {
    return this.mobileRegistration.requestLoginOtp(dto.mobile);
  }

  @Public()
  @ApiOperation({ summary: 'Verify a mobile login code' })
  @ApiCsrfProtected()
  @ApiOkResponse({ type: SafeUserResponseDto })
  @HttpCode(HttpStatus.OK)
  @Post('login/mobile/verify')
  verifyMobileLogin(
    @Body() dto: VerifyMobileDto,
    @Req() request: Request,
  ): Promise<SafeUserResponse> {
    return this.mobileRegistration.verifyLoginOtp(dto, request);
  }

  @Public()
  @ApiOperation({ summary: 'Create a password-authenticated session' })
  @ApiCsrfProtected()
  @ApiOkResponse({ type: SafeUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  @ApiTooManyRequestsResponse({ description: 'Login is throttled.' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
  ): Promise<SafeUserResponse> {
    return this.auth.login(dto, request);
  }

  @ApiOperation({ summary: 'Return the current authenticated customer' })
  @ApiSessionAuthenticated()
  @ApiOkResponse({ type: SafeUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @Get('me')
  me(@Req() request: Request): SafeUserResponse {
    return request.authUser!;
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the current session' })
  @ApiSessionAuthenticated()
  @ApiCsrfProtected()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(request);
    this.clearSessionCookie(response);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all sessions for the current customer' })
  @ApiSessionAuthenticated()
  @ApiCsrfProtected()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @Post('logout-all')
  async logoutAll(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logoutAll(request.authUser!.id, request);
    this.clearSessionCookie(response);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change the current customer password' })
  @ApiSessionAuthenticated()
  @ApiCsrfProtected()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Session or password is invalid.' })
  @Post('password/change')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    return this.auth.changePassword(request.authUser!.id, dto, request);
  }

  private clearSessionCookie(response: Response): void {
    response.clearCookie(
      this.sessionConfiguration.cookieName,
      clearCookieOptions(this.sessionConfiguration),
    );
  }
}
