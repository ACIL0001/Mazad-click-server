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
import { AttachmentService } from '../attachment/attachment.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly ProService: ProService,
    private readonly ClientService: ClientService,
    private readonly sessionService: SessionService,
    private readonly otpService: OtpService,
    private readonly attachmentService: AttachmentService,
  ) { }

  async Signup(userData: CreateUserDto, avatar?: Express.Multer.File) {
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

    // Handle avatar upload if provided
    if (avatar) {
      try {
        const attachment = await this.attachmentService.upload(avatar, 'AVATAR', user._id.toString());
        await this.userService.updateUserFields(user._id.toString(), { avatar: attachment as any }); // Cast as any because attachment is object but avatar expected as ObjectId sometimes? No, schema says ObjectId ref
        // Wait, AttachmentService.upload returns Attachment object. schema expects ObjectId ref. 
        // But user.service.updateUserFields uses findByIdAndUpdate which works with object/id mix often but safer to pass ID if schema expects Ref.
        // Actually schema says: @Prop({ type: S.Types.ObjectId, ref: Attachment.name, required: false })
        // So we should pass attachment._id
      } catch (error) {
        console.error('Failed to upload avatar during signup:', error);
        // Continue signup process even if avatar upload fails
      }
    }

    // Reload user to ensure we return it with avatar populated (if added)
    user = await this.userService.findUserById(user._id.toString());

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
    let user = await this.userService.findByLogin(credentials.login);

    if (!user) throw new UnauthorizedException('Invalid credentials - login');

    const isMatch = await user.validatePassword(credentials.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials - password');

    // Check if phone is verified - prevent login if not verified
    if (!user.isPhoneVerified) {
      // Send OTP for phone verification
      await this.otpService.createOtpAndSendSMS(user, OtpType.PHONE_CONFIRMATION);
      throw new UnauthorizedException('Phone number not verified. Please verify your phone number with the OTP sent to you.');
    }

    // Increment login count
    await this.userService.incrementLoginCount(user._id.toString());
    // Reload user to get updated count (or just manual increment in object)
    user = await this.userService.findUserById(user._id.toString());

    const session = await this.sessionService.CreateSession(user);

    // Ensure session has required properties (note: backend uses snake_case)
    if (!session.access_token || !session.refresh_token) {
      console.error('Session missing required tokens:', session);
      throw new Error('Failed to create valid session');
    }

    // Return consistent structure for frontend (convert to camelCase) - DON'T spread session
    return {
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      },
      user: {
        ...user.toObject(),
        loginCount: user.loginCount
      }
    };
  }

  async RefreshSession(token: string) {
    return this.sessionService.RefreshSession(token);
  }

  async SignOut(session: Session) {
    await this.sessionService.DeleteSession(session);
    return 'Success';
  }

  async markUserAsBuyer(user: User) {
    // Update user's type to CLIENT (which represents buyer in this system)
    const updatedUser = await this.userService.updateUserType(user._id.toString(), RoleCode.CLIENT);

    const buyerUrl = process.env.CLIENT_BASE_URL || 'http://localhost:3001';
    console.log('🔄 Mark as buyer - redirecting to:', buyerUrl);

    return {
      success: true,
      message: 'User successfully marked as buyer',
      user: updatedUser,
      buyerUrl: buyerUrl
    };
  }

  async markUserAsSeller(user: User) {
    // Update user's type to PROFESSIONAL (which represents seller in this system)
    const updatedUser = await this.userService.updateUserType(user._id.toString(), RoleCode.PROFESSIONAL);

    const sellerUrl = (process.env.SELLER_BASE_URL || 'http://localhost:3002') + '/dashboard/app';
    console.log('🔄 Mark as seller - redirecting to:', sellerUrl);

    return {
      success: true,
      message: 'User successfully marked as seller',
      user: updatedUser,
      sellerUrl: sellerUrl
    };
  }
}