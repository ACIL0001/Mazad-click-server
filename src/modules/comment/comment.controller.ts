import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { CommentService } from './comment.service';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) { }

  @Post()
  async create(@Body() body: { comment: string; user: string }) {
    return this.commentService.create(body.comment, body.user);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.commentService.findById(id);
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
  async getBidWithComments(@Param('bidId') bidId: string) {
    return this.commentService.getBidWithComments(bidId);
  }

  @Post(':id/reply')
  async replyToComment(
    @Param('id') id: string,
    @Body() body: { comment: string; user: string }
  ) {
    return this.commentService.replyToComment(id, body.comment, body.user);
  }
} 