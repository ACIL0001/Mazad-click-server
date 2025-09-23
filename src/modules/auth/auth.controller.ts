import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ProtectedRequest, PublicRequest } from 'src/types/request.type';
import { CreateUserDto } from './dto/createUser.dto';
import { SignInDto } from './dto/signin.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { ResetPasswordDto } from './dto/reset-password.dto';
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
  ) {}

  @Public()
  @Post('signup')
  async signup(
    @Request() request: PublicRequest,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.authService.Signup(createUserDto);
  }

  @Public()
  @Post('signin')
  async signin(
    @Request() request: PublicRequest,
    @Body() signInDto: SignInDto,
  ) {
    return this.authService.SignIn(signInDto);
  }

  @Delete('signout')
  @UseGuards(AuthGuard)
  async signout(@Request() request: ProtectedRequest) {
    return this.authService.SignOut(request.session);
  }
  
  @Get('validate-token')
  @UseGuards(AuthGuard)
  async validateToken(@Request() request: ProtectedRequest) {
    // If this endpoint is reached, it means the token is valid
    // The AuthGuard has already validated the token
    return { 
      valid: true, 
      user: request.session.user,
      message: 'Token is valid'
    };
  }
  
  @Get('status')
  @UseGuards(AuthGuard)
  async status(@Request() request: ProtectedRequest) {
    // Return user data with session information
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
  async refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.RefreshSession(refreshToken);
  }

  @Public()
  @Post('reset-password/confirm')
  async resetPassword(@Body() data: ResetPasswordDto) {
    // 1. Find user by phone
    const user = await this.userService.findByLogin(data.phone);
    if (!user) throw new NotFoundException('User not found for this phone number');

    // 2. Validate OTP
    const otp = await this.otpService.validateByCode(data.code, user);
    if (!otp || otp.type !== OtpType.FORGOT_PASSWORD)
      throw new BadRequestException('Invalid or expired OTP');

    // 3. Update password
    await this.userService.updatePassword(user._id, data.newPassword);

    // 4. Optionally, mark OTP as used

    return { message: 'Password reset successful' };
  }

}
