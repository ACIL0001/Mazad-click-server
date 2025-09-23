import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { CommentService } from './comment.service';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

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

  @Get('bid/:bidId')
  async getBidWithComments(@Param('bidId') bidId: string) {
    return this.commentService.getBidWithComments(bidId);
  }
} 