import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request as ExpressRequest } from 'express';
import { randomUUID } from 'crypto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ProtectedRequest, PublicRequest } from 'src/types/request.type';
import { CreateUserDto } from './dto/createUser.dto';
import { SignInDto } from './dto/signin.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { UserService } from '../user/user.service';
import { OtpService } from '../otp/otp.service';
import { OtpType } from '../otp/schema/otp.schema';
import { NotFoundException, BadRequestException } from '@nestjs/common';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly otpService: OtpService,
  ) { }

  @Public()
  @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 signups per minute
  @Post('signup')
  @UseInterceptors(FileInterceptor('avatar'))
  async signup(
    @Request() request: PublicRequest,
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    // If an avatar was uploaded, we might want to process it here or pass it to the service
    // For now, enabling the interceptor fixes the body parsing issue
    return this.authService.Signup(createUserDto, avatar);
  }

  @Public()
  @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 attempts per minute
  @Post('signin')
  async signin(
    @Request() request: PublicRequest,
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.SignIn(signInDto);
    
    // Set Refresh Token HttpOnly Cookie
    res.cookie('refresh_token', result.session.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Generate and Set CSRF Token Cookie (Readable by JS)
    const csrfToken = randomUUID();
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    // Remove refreshToken from the response body for security
    return {
      session: {
        accessToken: result.session.accessToken,
      },
      user: result.user,
    };
  }

  @Delete('signout')
  @UseGuards(AuthGuard)
  async signout(
    @Request() request: ProtectedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.SignOut(request.session);
    res.clearCookie('refresh_token', { sameSite: 'none', secure: true });
    res.clearCookie('csrf_token', { sameSite: 'none', secure: true });
    return result;
  }

  @Get('validate-token')
  @UseGuards(AuthGuard)
  async validateToken(
    @Request() request: ProtectedRequest,
    @Res({ passthrough: true }) res: Response,
    @Req() req: ExpressRequest,
  ) {
    if (!req.cookies['csrf_token']) {
      const csrfToken = randomUUID();
      res.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    return {
      valid: true,
      user: request.session.user,
      message: 'Token is valid'
    };
  }

  @Get('status')
  @UseGuards(AuthGuard)
  async status(
    @Request() request: ProtectedRequest,
    @Res({ passthrough: true }) res: Response,
    @Req() req: ExpressRequest,
  ) {
    if (!req.cookies['csrf_token']) {
      const csrfToken = randomUUID();
      res.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    return {
      authenticated: true,
      user: request.session.user,
      session: {
        id: request.session._id,
        createdAt: request.session.createdAt,
      }
    };
  }

  @Public()
  @Put('refresh')
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing from cookies');
    }

    const tokens = await this.authService.RefreshSession(refreshToken);
    
    // Rotate the refresh token cookie
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: tokens.access_token,
    };
  }

  @Public()
  @Post('reset-password/confirm')
  async resetPassword(@Body() data: ResetPasswordDto) {
    const user = await this.userService.findByLogin(data.phone);
    if (!user) throw new NotFoundException('User not found for this phone number');

    const otp = await this.otpService.validateByCode(data.code, user);
    if (!otp || otp.type !== OtpType.FORGOT_PASSWORD)
      throw new BadRequestException('Invalid or expired OTP');

    await this.userService.updatePassword(user._id, data.newPassword);

    return { message: 'Password reset successful' };
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  @Public()
  @Post('reset-password-email')
  async resetPasswordEmail(@Body() body: { email: string; code: string; newPassword: string }) {
    return this.authService.resetPassword(body.email, body.code, body.newPassword);
  }

  @Post('mark-as-buyer')
  @UseGuards(AuthGuard)
  async markAsBuyer(@Request() request: ProtectedRequest) {
    return this.authService.markUserAsBuyer(request.session.user);
  }

  @Post('mark-as-seller')
  @UseGuards(AuthGuard)
  async markAsSeller(@Request() request: ProtectedRequest) {
    return this.authService.markUserAsSeller(request.session.user);
  }
}