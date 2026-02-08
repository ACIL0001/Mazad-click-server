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
import { ConfigService } from '@nestjs/config';
import { ParticipantService } from './participant.service';

// Helper to transform attachment(s) to minimal shape with fullUrl
function transformAttachment(att, baseUrl?: string) {
  if (!att) return null;

  // Compute base URL if not provided
  const apiBase = baseUrl || (() => {
    const apiBaseUrl = process.env.API_BASE_URL ||
      (() => {
        const appHost = process.env.APP_HOST || 'http://localhost';
        const appPort = process.env.APP_PORT || '3000';
        const isProduction = process.env.NODE_ENV === 'production';

        if (isProduction && (appHost.includes('localhost') || !appHost.startsWith('https'))) {
          return 'https://mazadclick-server.onrender.com';
        }

        const hostPart = appPort && !appHost.includes(':') ? appHost.replace(/\/$/, '') : appHost.replace(/\/$/, '');
        return appPort && !hostPart.includes(':') ? `${hostPart}:${appPort}` : hostPart;
      })();
    return apiBaseUrl.replace(/\/$/, '');
  })();

  if (Array.isArray(att)) {
    return att.filter(Boolean).map(a => {
      if (!a || !a.url) return null;
      const fullUrl = a.fullUrl || `${apiBase}${a.url}`;
      return {
        url: a.url,
        fullUrl: fullUrl,
        _id: a._id,
        filename: a.filename
      };
    }).filter(Boolean);
  }

  if (!att.url) return null;
  const fullUrl = att.fullUrl || `${apiBase}${att.url}`;
  return {
    url: att.url,
    fullUrl: fullUrl,
    _id: att._id,
    filename: att.filename
  };
}

@ApiTags('Bids')
@Controller('bid')
export class BidController {
  private readonly baseUrl: string;

  constructor(
    private readonly bidService: BidService,
    private readonly attachmentService: AttachmentService,
    private readonly userService: UserService,
    private readonly auctionNotificationService: AuctionNotificationService,
    private readonly configService: ConfigService,
    private readonly participantService: ParticipantService,
  ) {
    // Compute base URL for fullUrl construction
    const apiBaseUrl = this.configService.get<string>('API_BASE_URL') ||
      process.env.API_BASE_URL ||
      (() => {
        const appHost = this.configService.get<string>('APP_HOST', 'http://localhost');
        const appPort = this.configService.get<number>('APP_PORT', 3000);
        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

        if (isProduction && (appHost.includes('localhost') || !appHost.startsWith('https'))) {
          return 'https://mazadclick-server.onrender.com';
        }

        const hostPart = appPort && !appHost.includes(':') ? appHost.replace(/\/$/, '') : appHost.replace(/\/$/, '');
        return appPort && !hostPart.includes(':') ? `${hostPart}:${appPort}` : hostPart;
      })();
    this.baseUrl = apiBaseUrl.replace(/\/$/, '');
  }

  @Get()
  @Public()
  async findAll(@Request() req: any) {
    const user = req.session?.user;
    const bids = await this.bidService.findAll(user);
    // console.log('Bids with populated thumbs:', bids.map(bid => ({
    //   id: bid._id,
    //   thumbs: bid.thumbs,
    // })));
    return bids.map((bid) => ({
      ...JSON.parse(JSON.stringify(bid)),
      thumbs: transformAttachment(bid.thumbs, this.baseUrl),
      videos: transformAttachment(bid.videos, this.baseUrl),
    }));
  }

  @Post('sync-participants')
  @Public()
  async syncParticipants() {
    return this.participantService.syncAllBidParticipantCounts();
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
      message: 'done',
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

      // console.log('vl :', vl);

      return {
        ...JSON.parse(JSON.stringify(bid)),
        thumbs: transformAttachment(bid.thumbs, this.baseUrl),
        videos: transformAttachment(bid.videos, this.baseUrl),
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
    console.log('BidController.create - Session User ID:', userId);

    if (!userId) {
      console.error('BidController.create - No User ID in Session!', { session: req.session });
      throw new Error('User ID not found in session. Cannot create bid.');
    }

    if (!rawData) {
      console.error('BidController.create - No "data" field in body!');
      throw new Error('Missing "data" field in request body');
    }

    console.log('Creating bid with data:', rawData);
    console.log('Uploaded files count:', files?.length || 0);

    let createBidDto: CreateBidDto;
    try {
      createBidDto = JSON.parse(rawData);
    } catch (e) {
      console.error('BidController.create - JSON Parse Error:', e.message);
      throw new Error('Invalid JSON format in "data" field');
    }

    // Initialize thumbs and videos arrays if not present
    if (!createBidDto.thumbs) {
      createBidDto.thumbs = [];
    }
    if (!createBidDto.videos) {
      createBidDto.videos = [];
    }

    if (files && files.length > 0) {
      // Log all file fieldnames to debug
      const allFieldnames = [...new Set(files.map(f => f.fieldname))];
      console.log('All unique fieldnames received:', allFieldnames);

      // Separate images and videos based on fieldname (handle both 'thumbs[]' and 'thumbs')
      // Multer might process the fieldname differently
      let imageFiles = files.filter(file => {
        const isThumbsField = file.fieldname === 'thumbs[]' ||
          file.fieldname === 'thumbs' ||
          file.fieldname.startsWith('thumbs');
        const isImage = file.mimetype.startsWith('image/');
        return isThumbsField && isImage;
      });

      // Fallback: if no images found with thumbs fieldname, check all image files
      if (imageFiles.length === 0) {
        console.warn('No images found with thumbs fieldname, checking all image files...');
        const allImages = files.filter(file => file.mimetype.startsWith('image/'));
        if (allImages.length > 0) {
          console.warn('Found', allImages.length, 'image files with fieldnames:', allImages.map(f => f.fieldname));
          imageFiles = allImages; // Use all images as fallback
        }
      }

      let videoFiles = files.filter(file => {
        const isVideosField = file.fieldname === 'videos[]' ||
          file.fieldname === 'videos' ||
          file.fieldname.startsWith('videos');
        const isVideo = file.mimetype.startsWith('video/');
        return isVideosField && isVideo;
      });

      // Fallback: if no videos found with videos fieldname, check all video files
      if (videoFiles.length === 0) {
        console.warn('No videos found with videos fieldname, checking all video files...');
        const allVideos = files.filter(file => file.mimetype.startsWith('video/'));
        if (allVideos.length > 0) {
          console.warn('Found', allVideos.length, 'video files with fieldnames:', allVideos.map(f => f.fieldname));
          videoFiles = allVideos; // Use all videos as fallback
        }
      }

      console.log('Filtered image files:', imageFiles.length);
      console.log('Filtered video files:', videoFiles.length);
      console.log('Image file details:', imageFiles.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype })));
      console.log('Video file details:', videoFiles.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype })));

      // Handle image uploads
      if (imageFiles.length > 0) {
        try {
          const imageAttachmentPromises = imageFiles.map(async (file) => {
            try {
              console.log('Uploading image file:', file.originalname);
              const att = await this.attachmentService.upload(
                file,
                AttachmentAs.BID,
                userId,
              );
              console.log('Image attachment created:', att._id, att.url);
              return att;
            } catch (error) {
              console.error('Error uploading image file:', file.originalname, error);
              throw error;
            }
          });
          const imageAttachments = await Promise.all(imageAttachmentPromises);
          const thumbIds = imageAttachments
            .filter(att => att && att._id)
            .map((att) => {
              const id = att._id.toString();
              console.log('Adding thumb ID:', id, 'from attachment:', att._id);
              return id;
            });
          createBidDto.thumbs = thumbIds;
          console.log('Thumbs IDs set (count:', thumbIds.length, '):', createBidDto.thumbs);
          if (thumbIds.length === 0 && imageFiles.length > 0) {
            console.error('WARNING: No valid thumb IDs were extracted from', imageAttachments.length, 'attachments');
            console.error('Attachment details:', imageAttachments.map(a => ({
              hasId: !!a?._id,
              id: a?._id?.toString(),
              url: a?.url
            })));
          }
        } catch (error) {
          console.error('Error processing image uploads:', error);
          throw new Error(`Failed to upload images: ${error.message}`);
        }
      }

      // Handle video uploads
      if (videoFiles.length > 0) {
        try {
          const videoAttachmentPromises = videoFiles.map(async (file) => {
            try {
              console.log('Uploading video file:', file.originalname);
              const att = await this.attachmentService.upload(
                file,
                AttachmentAs.BID,
                userId,
              );
              console.log('Video attachment created:', att._id, att.url);
              return att;
            } catch (error) {
              console.error('Error uploading video file:', file.originalname, error);
              throw error;
            }
          });
          const videoAttachments = await Promise.all(videoAttachmentPromises);
          const videoIds = videoAttachments
            .filter(att => att && att._id)
            .map((att) => {
              const id = att._id.toString();
              console.log('Adding video ID:', id, 'from attachment:', att._id);
              return id;
            });
          createBidDto.videos = videoIds;
          console.log('Videos IDs set (count:', videoIds.length, '):', createBidDto.videos);
          if (videoIds.length === 0 && videoFiles.length > 0) {
            console.error('WARNING: No valid video IDs were extracted from', videoAttachments.length, 'attachments');
            console.error('Attachment details:', videoAttachments.map(a => ({
              hasId: !!a?._id,
              id: a?._id?.toString(),
              url: a?.url
            })));
          }
        } catch (error) {
          console.error('Error processing video uploads:', error);
          throw new Error(`Failed to upload videos: ${error.message}`);
        }
      }
    } else {
      console.warn('No files received in the request');
    }

    if (!createBidDto.owner) {
      createBidDto.owner = userId;
    }

    // Final validation before creating bid
    console.log('Final bid DTO before service call:', {
      title: createBidDto.title,
      thumbsCount: createBidDto.thumbs?.length || 0,
      thumbs: createBidDto.thumbs,
      videosCount: createBidDto.videos?.length || 0,
      videos: createBidDto.videos
    });

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
    console.log('Relaunch endpoint called with:', JSON.stringify(relaunchBidDto, null, 2));
    console.log('Request session:', request.session);
    console.log('Request headers:', request.headers);

    const userId = request.session?.user?._id?.toString();
    console.log('User ID:', userId);

    if (!userId) {
      console.log('No user ID found in session');
      throw new Error('User ID not found in session. Cannot relaunch bid.');
    }

    try {
      // Validate the DTO manually to get better error messages
      console.log('Validating DTO fields...');
      console.log('originalBidId:', relaunchBidDto.originalBidId);
      console.log('title:', relaunchBidDto.title);
      console.log('description:', relaunchBidDto.description);
      console.log('place:', relaunchBidDto.place);
      console.log('startingPrice:', relaunchBidDto.startingPrice);
      console.log('startingAt:', relaunchBidDto.startingAt, typeof relaunchBidDto.startingAt);
      console.log('endingAt:', relaunchBidDto.endingAt, typeof relaunchBidDto.endingAt);
      console.log('isPro:', relaunchBidDto.isPro, typeof relaunchBidDto.isPro);
      console.log('auctionType:', relaunchBidDto.auctionType);

      const result = await this.bidService.relaunchBid(relaunchBidDto, userId);
      console.log('Relaunch successful, returning result:', result);
      return result;
    } catch (error) {
      console.error('Error in relaunch controller:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
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
