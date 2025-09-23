import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UploadedFiles,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Express } from 'express';
import { FilesInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Multer } from 'multer';
import { BidService } from './bid.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { UpdateBidDto } from './dto/update-bid.dto';
import { RelaunchBidDto } from './dto/relaunch-bid.dto';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { AttachmentService } from '../attachment/attachment.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ProtectedRequest } from 'src/types/request.type';
import { AttachmentAs } from '../attachment/schema/attachment.schema';
import { Types } from 'mongoose';
import { OfferService } from './offer.service';
import { UserService } from '../user/user.service';
import { AuctionNotificationService } from './auction-notification.service';


// Helper to transform attachment(s) to minimal shape
function transformAttachment(att) {
  if (!att) return null;
  if (Array.isArray(att)) {
    return att.filter(Boolean).map(a => a && a.url ? ({ url: a.url, _id: a._id, filename: a.filename }) : null).filter(Boolean);
  }
  return att.url ? { url: att.url, _id: att._id, filename: att.filename } : null;
}


@ApiTags('Bids')
@Controller('bid')
export class BidController {
  constructor(
    private readonly bidService: BidService,
    private readonly attachmentService: AttachmentService,
    private readonly userService: UserService,
    private readonly auctionNotificationService: AuctionNotificationService,
  ) {}

  @Get()
  @Public()
  async findAll() {
    const bids = await this.bidService.findAll();
    console.log('Bids with populated thumbs:', bids.map(bid => ({
    id: bid._id,
    thumbs: bid.thumbs,
  })));
    return bids.map((bid) => ({
      ...JSON.parse(JSON.stringify(bid)),
      thumbs: transformAttachment(bid.thumbs),
      videos: transformAttachment(bid.videos),
    }));
  }

  @Get('health')
  @Public()
  async healthCheck() {
    return {
      status: 'ok',
      message: 'Bid service is running',
      timestamp: new Date().toISOString()
    };
  }

  @Get('my-bids')
  @UseGuards(AuthGuard)
  findMyBids(@Request() request: ProtectedRequest) {
    return this.bidService.findByOwner(request.session.user._id.toString());
  }

  @Get('my-finished-bids')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get finished auctions for relaunch' })
  findMyFinishedBids(@Request() request: ProtectedRequest) {
    return this.bidService.findFinishedBidsByOwner(request.session.user._id.toString());
  }

  @Post('check')
  async checkBidsToUser(@Body('id') id: any) {
    let vl = this.bidService.checkBids(id);
    return {
       message:'done' ,
       vl
    }
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    try {
      const bid = await this.bidService.findOne(id);
      let vl: any = null;
      
      if (bid.winner) {
        try {
          const getuser = await this.userService.getUserById(bid.winner.toString());
          vl = getuser;
        } catch (userError) {
          console.error('Error fetching winner user:', userError);
          // Continue without the user data if there's an error
        }
      }
      
      console.log('vl :', vl);
      
      return {
        ...JSON.parse(JSON.stringify(bid)),
        thumbs: transformAttachment(bid.thumbs),
        videos: transformAttachment(bid.videos),
        user: vl
      };
    } catch (error) {
      console.error('Error in findOne:', error);
      throw error;
    }
  }

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      fileFilter: (req, file, cb) => {
        // Allow both images and videos
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image and video files are allowed'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'JSON string of bid details (CreateBidDto)',
        },
        'thumbs[]': {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Array of image files for the bid. Field name: thumbs[]',
        },
        'videos[]': {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Array of video files for the bid. Field name: videos[]',
        },
      },
      required: ['data'],
    },
  })
  async create(
    @Request() req: ProtectedRequest,
    @Body('data') rawData: string,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    const userId = req.session?.user?._id?.toString();
    if (!userId) {
      throw new Error('User ID not found in session. Cannot create bid.');
    }

    console.log('Creating bid with data:', rawData);
    console.log('Uploaded files:', files?.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype })));

    const createBidDto: CreateBidDto = JSON.parse(rawData);

    if (files && files.length > 0) {
      // Separate images and videos based on fieldname
      const imageFiles = files.filter(file => 
        file.fieldname === 'thumbs[]' && file.mimetype.startsWith('image/')
      );
      const videoFiles = files.filter(file => 
        file.fieldname === 'videos[]' && file.mimetype.startsWith('video/')
      );

      console.log('Image files:', imageFiles.length);
      console.log('Video files:', videoFiles.length);

      // Handle image uploads
      if (imageFiles.length > 0) {
        const imageAttachmentPromises = imageFiles.map(async (file) => {
          const att = await this.attachmentService.upload(
            file,
            AttachmentAs.BID,
            userId,
          );
          return att;
        });
        const imageAttachments = await Promise.all(imageAttachmentPromises);
        createBidDto.thumbs = imageAttachments.map((att) => att._id.toString());
      }

      // Handle video uploads
      if (videoFiles.length > 0) {
        const videoAttachmentPromises = videoFiles.map(async (file) => {
          const att = await this.attachmentService.upload(
            file,
            AttachmentAs.BID,
            userId,
          );
          return att;
        });
        const videoAttachments = await Promise.all(videoAttachmentPromises);
        createBidDto.videos = videoAttachments.map((att) => att._id.toString());
      }
    }

    if (!createBidDto.owner) {
      createBidDto.owner = userId;
    }

    return this.bidService.create(createBidDto);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  update(@Param('id') id: string, @Body() updateBidDto: UpdateBidDto) {
    return this.bidService.update(id, updateBidDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bidService.remove(id);
  }

  @Post('relaunch')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Relaunch a finished and closed auction' })
  async relaunchBid(
    @Request() request: ProtectedRequest,
    @Body() relaunchBidDto: RelaunchBidDto,
  ) {
    console.log('Relaunch endpoint called with:', relaunchBidDto);
    console.log('Request session:', request.session);
    
    const userId = request.session?.user?._id?.toString();
    console.log('User ID:', userId);
    
    if (!userId) {
      console.log('No user ID found in session');
      throw new Error('User ID not found in session. Cannot relaunch bid.');
    }

    try {
      const result = await this.bidService.relaunchBid(relaunchBidDto, userId);
      console.log('Relaunch successful, returning result:', result);
      return result;
    } catch (error) {
      console.error('Error in relaunch controller:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Return a more specific error message
      if (error.message) {
        throw new Error(`Relaunch failed: ${error.message}`);
      } else {
        throw new Error('Relaunch failed due to an internal error');
      }
    }
  }

  @Get('debug/active-auctions')
  @Public()
  @ApiOperation({ summary: 'Get active auctions with timing info (for debugging)' })
  async getActiveAuctionsWithTiming() {
    return this.auctionNotificationService.getActiveAuctionsWithTiming();
  }

  @Post('debug/trigger-notifications')
  @Public()
  @ApiOperation({ summary: 'Manually trigger notification check (for debugging)' })
  async triggerNotificationCheck() {
    await this.auctionNotificationService.triggerNotificationCheck();
    return { message: 'Notification check triggered manually' };
  }
}
