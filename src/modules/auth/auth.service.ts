import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CreateUserDto } from './dto/createUser.dto';
import { SignInDto } from './dto/signin.dto';
import { SessionService } from '../session/session.service';
import { OtpService } from '../otp/otp.service';
import { OtpType } from '../otp/schema/otp.schema';
import { ProService } from '../user/services/pro.service';
import { ClientService } from '../user/services/client.service';
import { User } from '../user/schema/user.schema';
import { Session } from '../session/schema/session.schema';
import { RoleCode } from '../apikey/entity/appType.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly ProService: ProService,
    private readonly ClientService: ClientService,
    private readonly sessionService: SessionService,
    private readonly otpService: OtpService,
  ) {}

  async Signup(userData: CreateUserDto) {
    await this.userService.verifyEmailPhoneNumber({
      email: userData.email,
      phone: userData.phone,
    });

    let user: User;
    if (userData.type === RoleCode.CLIENT) {
      user = await this.ClientService.create(userData);
    } else if (userData.type == RoleCode.PROFESSIONAL) {
      user = await this.ProService.create(userData);
    } else {
      throw new ForbiddenException();
    }

    // Always send OTP for phone verification since isPhoneVerified defaults to false
    await this.otpService.createOtpAndSendSMS(user, OtpType.PHONE_CONFIRMATION);
    
    // Do NOT create session/tokens until phone is verified
    // Frontend should redirect to OTP verification page
    return { 
      user, 
      message: 'Registration successful. Please verify your phone number with the OTP sent to you.',
      requiresPhoneVerification: true
    };
  }

  async SignIn(credentials: SignInDto) {
    const user = await this.userService.findByLogin(credentials.login);
    console.log('Password = ', credentials.password);
    
    if (!user) throw new UnauthorizedException('Invalid credentials - login');
    
    const isMatch = await user.validatePassword(credentials.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials - password');

    // Check if phone is verified - prevent login if not verified
    if (!user.isPhoneVerified) {
      // Send OTP for phone verification
      await this.otpService.createOtpAndSendSMS(user, OtpType.PHONE_CONFIRMATION);
      throw new UnauthorizedException('Phone number not verified. Please verify your phone number with the OTP sent to you.');
    }

    const session = await this.sessionService.CreateSession(user);
    console.log('User +++ ', user);
    console.log('Session created:', session);

    // Ensure session has required properties (note: backend uses snake_case)
    if (!session.access_token || !session.refresh_token) {
      console.error('Session missing required tokens:', session);
      throw new Error('Failed to create valid session');
    }

    // Return consistent structure for frontend (convert to camelCase)
    return { 
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        // Include other session properties if needed
        ...session
      }, 
      user 
    };
  }

  async RefreshSession(token: string) {
    return this.sessionService.RefreshSession(token);
  }

  async SignOut(session: Session) {
    await this.sessionService.DeleteSession(session);
    return 'Success';
  }
}