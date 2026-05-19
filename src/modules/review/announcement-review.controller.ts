import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { AnnouncementReviewService } from './announcement-review.service';
import { ProtectedRequest } from 'src/types/request.type';

@Controller('announcement-review')
export class AnnouncementReviewController {
  constructor(private readonly service: AnnouncementReviewService) {}

  /**
   * POST /announcement-review/:model/:announcementId
   * Body: { stars: number, comment?: string }
   * Auth: JWT required — only the verified winner/buyer can submit
   */
  @Post(':model/:announcementId')
  @UseGuards(AuthGuard)
  createReview(
    @Request() req: ProtectedRequest,
    @Param('model') model: 'Bid' | 'DirectSale' | 'Tender',
    @Param('announcementId') announcementId: string,
    @Body('stars') stars: number,
    @Body('comment') comment?: string,
  ) {
    return this.service.createOrUpdateReview(
      req.session.user._id.toString(),
      announcementId,
      model,
      Number(stars),
      comment,
    );
  }

  /**
   * GET /announcement-review/can-review/:model/:announcementId
   * Returns { eligible, availableAt, expiresAt, alreadyReviewed, reason }
   * Used by frontend to decide when/whether to show the rating popup
   */
  @Get('can-review/:model/:announcementId')
  @UseGuards(AuthGuard)
  canReview(
    @Request() req: ProtectedRequest,
    @Param('model') model: 'Bid' | 'DirectSale' | 'Tender',
    @Param('announcementId') announcementId: string,
  ) {
    return this.service.canReview(
      req.session.user._id.toString(),
      announcementId,
      model,
    );
  }

  /**
   * GET /announcement-review/user/:userId/score
   * Public — returns { score (0-100), rate (1-10) }
   */
  @Get('user/:userId/score')
  getUserScore(@Param('userId') userId: string) {
    return this.service.getUserScore(userId);
  }

  /**
   * GET /announcement-review/:announcementId
   * Public — returns all reviews for an announcement (populated with reviewer info)
   */
  @Get(':announcementId')
  getReviews(@Param('announcementId') announcementId: string) {
    return this.service.getAnnouncementReviews(announcementId);
  }
}
