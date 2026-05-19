import { Controller, Get, Param, Post, UploadedFile, UseInterceptors, Body, Request, UseGuards } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from 'src/common/decorators/public.decorator';
import { Multer } from 'multer';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';


// Helper function to generate unique filenames
const generateUniqueFilename = (req, file, callback) => {
  const name = file.originalname.split('.')[0];
  const fileExtName = extname(file.originalname);
  const randomName = Array(4)
    .fill(null)
    .map(() => Math.round(Math.random() * 16).toString(16))
    .join('');
  callback(null, `${name}-${randomName}${fileExtName}`);
};

// Helper function to ensure upload directory exists
const ensureUploadsDirectoryExists = (destinationPath) => {
  if (!fs.existsSync(destinationPath)) {
    fs.mkdirSync(destinationPath, { recursive: true });
  }
};

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
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, callback) => {
        const uploadsDir = join(process.cwd(), 'uploads');
        ensureUploadsDirectoryExists(uploadsDir);
        callback(null, uploadsDir);
      },
      filename: generateUniqueFilename,
    }),
  }))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Body('as') as: string,
    @Request() req
  ) {
    try {
      // Check if file is provided
      if (!file) {
        throw new Error('No file provided');
      }

      // Get userId from session or from request body (for guest users)
      const userId = req.session?.user?._id || req.body?.userId || null;
      
      // Map custom 'as' values to valid enum values
      let attachmentType = as;
      if (as === 'message-attachment') {
        attachmentType = 'MESSAGE';
      } else if (!['AVATAR', 'COVER', 'MESSAGE', 'IDENTITY', 'BID', 'CATEGORY', 'SUBCATEGORY'].includes(as)) {
        // Default to MESSAGE if not a valid enum value
        attachmentType = 'MESSAGE';
      }
      
      console.log('📤 Uploading attachment:', {
        filename: file.originalname,
        size: file.size,
        type: file.mimetype,
        as: attachmentType,
        userId
      });
      
      return await this.attachmentService.upload(file, attachmentType, userId);
    } catch (error) {
      console.error('❌ Error in uploadAttachment:', error);
      throw error;
    }
  }
}
