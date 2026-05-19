import { Controller, Post, Param, UseGuards, Request, Body } from '@nestjs/common';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { AdminGuard } from 'src/common/guards/admin.guard';
import { ReviewService } from './review.service';
import { ProtectedRequest } from 'src/types/request.type';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post('like/:userId')
  @UseGuards(AuthGuard)
  async likeUser(@Request() req: ProtectedRequest, @Param('userId') userId: string, @Body('comment') comment?: string) {
    return this.reviewService.likeUser(req.session.user._id.toString(), userId, comment);
  }

  @Post('dislike/:userId')
  @UseGuards(AuthGuard)
  async dislikeUser(@Request() req: ProtectedRequest, @Param('userId') userId: string, @Body('comment') comment?: string) {
    return this.reviewService.dislikeUser(req.session.user._id.toString(), userId, comment);
  }

  @Post('rate/:userId')
  @UseGuards(AdminGuard)
  async adjustUserRateByAdmin(@Param('userId') userId: string, @Body('delta') delta: number) {
    return this.reviewService.adjustUserRateByAdmin(userId, delta);
  }
} 