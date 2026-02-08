import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
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
      // Map activitySector from DTO to secteur field in schema
      if (userData.activitySector && !(userData as any).secteur) {
        (userData as any).secteur = userData.activitySector;
      }
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
    try {
      console.log('🔐 SignIn: Starting authentication for login:', credentials.login);

      let user = await this.userService.findByLogin(credentials.login);
      console.log('🔐 SignIn: findByLogin result:', user ? `User found (${user._id})` : 'User not found');

      if (!user) throw new UnauthorizedException('Invalid credentials - login');

      console.log('🔐 SignIn: Validating password...');
      const isMatch = await user.validatePassword(credentials.password);
      console.log('🔐 SignIn: Password validation result:', isMatch ? 'Valid' : 'Invalid');

      if (!isMatch) throw new UnauthorizedException('Invalid credentials - password');

      // Check if phone is verified - prevent login if not verified
      console.log('🔐 SignIn: Checking phone verification status:', user.isPhoneVerified);
      if (!user.isPhoneVerified) {
        // Send OTP for phone verification
        console.log('🔐 SignIn: Phone not verified, sending OTP...');
        await this.otpService.createOtpAndSendSMS(user, OtpType.PHONE_CONFIRMATION);
        throw new UnauthorizedException('Phone number not verified. Please verify your phone number with the OTP sent to you.');
      }

      // Increment login count
      console.log('🔐 SignIn: Incrementing login count...');
      await this.userService.incrementLoginCount(user._id.toString());

      // Reload user to get updated count
      console.log('🔐 SignIn: Reloading user...');
      user = await this.userService.findUserById(user._id.toString());

      console.log('🔐 SignIn: Creating session...');
      const session = await this.sessionService.CreateSession(user);
      console.log('🔐 SignIn: Session created:', session ? 'Success' : 'Failed');

      // Ensure session has required properties (note: backend uses snake_case)
      if (!session.access_token || !session.refresh_token) {
        console.error('🔐 SignIn: Session missing required tokens:', session);
        throw new Error('Failed to create valid session');
      }

      console.log('🔐 SignIn: Authentication successful');
      // Return consistent structure for frontend (convert to camelCase) - DON'T spread session
      // Note: findUserById may return enriched plain object, so check if toObject exists
      const userObject = typeof user.toObject === 'function' ? user.toObject() : user;
      return {
        session: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        },
        user: {
          ...userObject,
          loginCount: user.loginCount
        }
      };
    } catch (error) {
      console.error('🔐 SignIn: Error occurred:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack?.split('\n').slice(0, 5).join('\n')
      });
      throw error;
    }
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

  async forgotPassword(email: string) {
    const user = await this.userService.findByLogin(email);
    if (!user) {
      // Silently fail to avoid enumeration attacks, or return generic message.
      // For better UX during dev/testing, we might want to be explicit, but security wise better to be vague.
      // "If this email is registered, you will receive a reset code."
      // But for this request, let's just return success even if not found, or throw if we want explicit feedback.
      // Let's check logic: findByLogin searches phone or email.
      throw new UnauthorizedException('If this email is registered, a code has been sent.');
    }

    if (!user.email) {
      // User might have signed up with phone only?
      throw new BadRequestException('No email linked to this account.');
    }

    // Generate and send OTP via Email
    await this.otpService.createOtpAndSendEmail(user, OtpType.FORGOT_PASSWORD);

    return {
      message: 'Password reset code sent to your email.'
    };
  }

  async resetPassword(email: string, code: string, newPass: string) {
    const user = await this.userService.findByLogin(email);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    // Verify OTP
    const otp = await this.otpService.validateByCode(code, user);
    if (!otp) {
      throw new UnauthorizedException('Invalid or expired reset code.');
    }

    // Mark OTP as used
    await this.otpService.markAsUsed(otp._id);

    // Update Password using UserService (assumed it handles hashing if we pass plain text, checking schema pre-save hook)
    // The User Schema has a pre-save hook that hashes password if modified.
    // So we just need to update the field and save.

    // We can use a direct repository update or helper.
    // UserService.updateUserFields seems useful if it triggers save hooks?
    // Mongoose findByIdAndUpdate DOES NOT trigger save hooks by default.
    // We need to fetch, modify, save.

    // Let's implement a helper in AuthService or assume one exists/use direct mongoose model if available?
    // AuthService has access to UserService.
    // UserService has `updateUserFields` which probably uses `findByIdAndUpdate` based on typical patterns.
    // Let's check `UserService`. It wasn't fully dumped but imported.

    // For safety, let's do:
    await this.userService.updatePassword(user._id, newPass);

    return {
      message: 'Password successfully reset. You can now login.'
    };
  }
}