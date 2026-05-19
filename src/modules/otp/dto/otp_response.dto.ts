export class OtpResponseDto {
  message: string;
  phone: string;
  timestamp?: string;
}

export class PhoneConfirmationResponseDto {
  user: any;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  message: string;
}

export class PasswordResetConfirmationResponseDto {
  message: string;
  userId: string;
  timestamp?: string;
}