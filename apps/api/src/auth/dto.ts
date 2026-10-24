import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

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
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'invalid token format' })
  token!: string;

  @IsString()
  @Length(12, 256)
  password!: string;

  @IsString()
  @Length(1, 120)
  deviceName!: string;
}

export class RefreshDto {
  // Refresh token travels in an HttpOnly cookie; body stays empty so the
  // token never lands in logs. DTO kept for OpenAPI shape.
}

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'invalid token format' })
  token!: string;

  @IsString()
  @Length(12, 256)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, 256)
  currentPassword!: string;

  @IsString()
  @Length(12, 256)
  newPassword!: string;
}

export class TotpVerifyDto {
  @IsString()
  @Length(6, 8)
  code!: string;
}
