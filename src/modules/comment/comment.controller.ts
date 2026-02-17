import { Controller, Post, Body, Get, Param, Request } from '@nestjs/common';
import { CommentService } from './comment.service';
import { RoleCode } from '../apikey/entity/appType.entity';
import { sanitizeUser } from 'src/common/utils';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) { }

  private sanitizeUser(u: any, user?: any) {
    return sanitizeUser(u, user);
  }

  private sanitizeComment(c: any, user?: any) {
    if (!c) return null;
    const sc = { ...c };
    if (c.user && typeof c.user === 'object') {
      sc.user = this.sanitizeUser(c.user, user);
    }
    if (c.replies && Array.isArray(c.replies)) {
      sc.replies = c.replies.map(r => this.sanitizeComment(r, user));
    }
    return sc;
  }

  @Post()
  async create(@Body() body: { comment: string; user: string }) {
    return this.commentService.create(body.comment, body.user);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Request() req: any) {
    const comment = await this.commentService.findById(id);
    return this.sanitizeComment(comment, req.session?.user);
  }

  @Post('bid/:bidId')
  async createForBid(
    @Param('bidId') bidId: string,
    @Body() body: { comment: string; user: string }
  ) {
    return this.commentService.createCommentForBid(body.comment, body.user, bidId);
  }

  @Post('direct-sale/:id')
  async createForDirectSale(
    @Param('id') id: string,
    @Body() body: { comment: string; user: string }
  ) {
    return this.commentService.createCommentForDirectSale(body.comment, body.user, id);
  }

  @Post('tender/:id')
  async createForTender(
    @Param('id') id: string,
    @Body() body: { comment: string; user: string }
  ) {
    return this.commentService.createCommentForTender(body.comment, body.user, id);
  }

  @Get('bid/:bidId')
  async getBidWithComments(@Param('bidId') bidId: string, @Request() req: any) {
    const bid = await this.commentService.getBidWithComments(bidId);
    if (!bid) return null;

    const user = req.session?.user;
    const result = { ...bid.toObject() };

    if (result.comments && Array.isArray(result.comments)) {
      result.comments = result.comments.map(c => this.sanitizeComment(c, user));
    }

    // Also sanitize bid owner if present
    if (result.owner && typeof result.owner === 'object') {
      // For simplicity here, just use sanitizeUser. 
      // Ideally we'd know if bid is hidden, but bid.owner is usually public enough 
      // except for contact info.
      result.owner = this.sanitizeUser(result.owner, user);
    }

    return result;
  }

  @Post(':id/reply')
  async replyToComment(
    @Param('id') id: string,
    @Body() body: { comment: string; user: string }
  ) {
    return this.commentService.replyToComment(id, body.comment, body.user);
  }
} 