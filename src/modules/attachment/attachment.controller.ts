import { Controller, Get, Param, Post, UploadedFile, UseInterceptors, Body, Request } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from 'src/common/decorators/public.decorator';
import { Multer } from 'multer';


@Controller('attachments')
@Public()
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Get(':id')
  async getAttachment(@Param('id') id: string) {
    return this.attachmentService.findById(id);
  }

  @Get('user/:userId/avatar')
  async getUserAvatar(@Param('userId') userId: string) {
    return this.attachmentService.getUserAvatar(userId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Body('as') as: string,
    @Request() req
  ) {
    const userId = req.session?.user?._id || null;
    return this.attachmentService.upload(file, as, userId);

  }
}
