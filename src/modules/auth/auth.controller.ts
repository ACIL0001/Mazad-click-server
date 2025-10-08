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
    return { 
      valid: true, 
      user: request.session.user,
      message: 'Token is valid'
    };
  }
  
  @Get('status')
  @UseGuards(AuthGuard)
  async status(@Request() request: ProtectedRequest) {
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
  async refresh(@Body() body: { refreshToken: string }) {
    const tokens = await this.authService.RefreshSession(body.refreshToken);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
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