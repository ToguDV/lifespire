import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { INVITE_TOKEN_PATTERN } from './invite-token';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 256)
  password!: string;

  @IsString()
  @Length(1, 120)
  deviceName!: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  totpCode?: string;
}

export class AcceptInviteDto {
  @IsString()
  @Matches(INVITE_TOKEN_PATTERN, { message: 'invalid token format' })
  token!: string;

  @IsString()
  @MaxLength(256)
  password!: string;

  @IsString()
  @Length(1, 120)
  deviceName!: string;
}

export class RefreshDto {
  /**
   * Native clients cannot rely on an HttpOnly cookie, so they present the
   * rotated refresh token in the body. Web keeps sending an empty body and
   * uses the cookie instead; the controller only reads this field when the
   * native-client gate passes.
   */
  @IsOptional()
  @IsString()
  @Length(32, 256)
  refreshToken?: string;
}

export class ResetPasswordDto {
  @IsString()
  @Matches(INVITE_TOKEN_PATTERN, { message: 'invalid token format' })
  token!: string;

  @IsString()
  @MaxLength(256)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, 256)
  currentPassword!: string;

  @IsString()
  @MaxLength(256)
  newPassword!: string;
}

export class TotpVerifyDto {
  @IsString()
  @Length(6, 8)
  code!: string;
}

export class TotpSetupDto {
  @IsString()
  @Length(1, 256)
  currentPassword!: string;
}
