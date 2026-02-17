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
import { DirectSaleService } from './direct-sale.service';
import { CreateDirectSaleDto } from './dto/create-direct-sale.dto';
import { UpdateDirectSaleDto } from './dto/update-direct-sale.dto';
import { PurchaseDirectSaleDto } from './dto/purchase-direct-sale.dto';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { AttachmentService } from '../attachment/attachment.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ProtectedRequest } from 'src/types/request.type';
import { AttachmentAs } from '../attachment/schema/attachment.schema';
import { ConfigService } from '@nestjs/config';
import { RoleCode } from '../apikey/entity/appType.entity';
import { getApiBaseUrl, transformAttachment, sanitizeUser } from 'src/common/utils';



@ApiTags('Direct Sales')
@Controller('direct-sale')
export class DirectSaleController {
  private readonly baseUrl: string;

  constructor(
    private readonly directSaleService: DirectSaleService,
    private readonly attachmentService: AttachmentService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = getApiBaseUrl();
  }

  private sanitizeUser(u: any, isOwnerAccount = false, directSale?: any, user?: any) {
    if (!u) return null;
    const isHidden = directSale?.hidden === true;
    const ownerId = directSale?.owner?._id?.toString() || directSale?.owner?.toString();
    return sanitizeUser(u, user, { isOwnerAccount, isHidden, ownerId });
  }

  private sanitizeDirectSale(directSale: any, user: any) {
    if (!directSale) return null;

    const userId = user?._id?.toString();
    const ownerId = directSale.owner && typeof directSale.owner === 'object' ? directSale.owner._id?.toString() : directSale.owner?.toString();
    const isAdmin = user?.type && (user.type === RoleCode.ADMIN || user.type === RoleCode.SOUS_ADMIN);
    const isOwner = userId && ownerId && userId === ownerId;

    // Whitelist fields
    const allowedFields = [
      '_id', 'title', 'description', 'attributes', 'productCategory', 'productSubCategory',
      'thumbs', 'videos', 'saleType', 'price', 'quantity', 'soldQuantity', 'wilaya', 'place',
      'isPro', 'professionalOnly', 'hidden', 'status', 'comments', 'createdAt', 'updatedAt'
    ];

    if (isAdmin || isOwner) {
      allowedFields.push('contactNumber');
    }

    const sanitized: any = {};
    for (const field of allowedFields) {
      if (directSale[field] !== undefined) {
        sanitized[field] = directSale[field];
      }
    }

    // Sanitize owner
    if (directSale.owner && typeof directSale.owner === 'object') {
      sanitized.owner = this.sanitizeUser(directSale.owner, true, directSale, user);
    }

    // Sanitize comments
    if (directSale.comments && Array.isArray(directSale.comments)) {
      const sanitizeComment = (c: any) => {
        if (!c) return null;
        const sc = { ...c };
        if (c.user && typeof c.user === 'object') {
          sc.user = this.sanitizeUser(c.user, false, directSale, user);
        }
        if (c.replies && Array.isArray(c.replies)) {
          sc.replies = c.replies.map(r => sanitizeComment(r));
        }
        return sc;
      };
      sanitized.comments = directSale.comments.map(c => sanitizeComment(c));
    }

    return sanitized;
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all active direct sales' })
  async findAll(@Request() req: any) {
    try {
      const user = req.session?.user;
      const directSales = await this.directSaleService.findAll(user);
      return directSales.map((directSale: any) => {
        const sanitized = this.sanitizeDirectSale(directSale, user);
        return {
          ...sanitized,
          thumbs: transformAttachment(directSale.thumbs, this.baseUrl),
          videos: transformAttachment(directSale.videos, this.baseUrl),
        };
      });
    } catch (error) {
      console.error('❌ Error in DirectSaleController.findAll:', error);
      throw error;
    }
  }

  @Get('admin/all')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all direct sales for admin' })
  async findAllForAdmin() {
    const directSales = await this.directSaleService.findAllForAdmin();
    return directSales.map((directSale: any) => ({
      ...directSale,
      thumbs: transformAttachment(directSale.thumbs, this.baseUrl),
      videos: transformAttachment(directSale.videos, this.baseUrl),
    }));
  }

  @Get('my-sales')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get my direct sales' })
  findMySales(@Request() request: ProtectedRequest) {
    return this.directSaleService.findByOwner(
      request.session.user._id.toString(),
    );
  }

  @Get('my-purchases')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get my purchases' })
  getMyPurchases(@Request() request: ProtectedRequest) {
    return this.directSaleService.getPurchasesByBuyer(
      request.session.user._id.toString(),
    );
  }

  @Get('my-orders')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get orders for my direct sales' })
  getMyOrders(@Request() request: ProtectedRequest) {
    return this.directSaleService.getPurchasesBySeller(
      request.session.user._id.toString(),
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a direct sale by ID' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    try {
      const directSale = await this.directSaleService.findOne(id);
      
      // Get user from session
      const user = (req as any).session?.user;

      const sanitized = this.sanitizeDirectSale(directSale, user);

      return {
        ...sanitized,
        thumbs: transformAttachment(directSale.thumbs, this.baseUrl),
        videos: transformAttachment(directSale.videos, this.baseUrl),
      };
    } catch (error) {
      console.error('Error in findOne:', error);
      throw error;
    }
  }

  @Get(':id/purchases')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get purchases for a direct sale' })
  getPurchasesByDirectSale(@Param('id') id: string) {
    return this.directSaleService.getPurchasesByDirectSale(id);
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
        if (
          file.mimetype.startsWith('image/') ||
          file.mimetype.startsWith('video/')
        ) {
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
          description: 'JSON string of CreateDirectSaleDto',
        },
        'thumbs[]': {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        'videos[]': {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['data'],
    },
  })
  @ApiOperation({ summary: 'Create a new direct sale' })
  async create(
    @Request() req: ProtectedRequest,
    @Body('data') rawData: string,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    const userId = req.session?.user?._id?.toString();
    if (!userId) {
      throw new Error('User ID not found in session. Cannot create direct sale.');
    }

    console.log('Creating direct sale with data:', rawData);
    console.log('Uploaded files count:', files?.length || 0);
    console.log('Uploaded files details:', files?.map(f => ({
      fieldname: f.fieldname,
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      filename: f.filename
    })));

    const createDirectSaleDto: CreateDirectSaleDto = JSON.parse(rawData);

    // Initialize thumbs and videos arrays
    if (!createDirectSaleDto.thumbs) {
      createDirectSaleDto.thumbs = [];
    }
    if (!createDirectSaleDto.videos) {
      createDirectSaleDto.videos = [];
    }

    if (files && files.length > 0) {
      // Log all file fieldnames to debug
      const allFieldnames = [...new Set(files.map(f => f.fieldname))];
      console.log('All unique fieldnames received:', allFieldnames);

      // Separate images and videos based on fieldname (handle both 'thumbs[]' and 'thumbs')
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
          imageFiles = allImages;
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
          videoFiles = allVideos;
        }
      }

      console.log('Filtered image files:', imageFiles.length);
      console.log('Filtered video files:', videoFiles.length);
      console.log('Image file details:', imageFiles.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype })));
      console.log('Video file details:', videoFiles.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype })));

      // Handle image uploads
      if (imageFiles.length > 0) {
        try {
          const thumbPromises = imageFiles.map(async (file) => {
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
          const thumbs = await Promise.all(thumbPromises);
          const thumbIds = thumbs
            .filter(att => att && att._id)
            .map((att) => {
              const id = att._id.toString();
              console.log('Adding thumb ID:', id, 'from attachment:', att._id);
              return id;
            });
          createDirectSaleDto.thumbs = thumbIds;
          console.log('Thumbs IDs set (count:', thumbIds.length, '):', createDirectSaleDto.thumbs);
          if (thumbIds.length === 0 && imageFiles.length > 0) {
            console.error('WARNING: No valid thumb IDs were extracted from', thumbs.length, 'attachments');
            console.error('Attachment details:', thumbs.map(a => ({
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
          const videoPromises = videoFiles.map(async (file) => {
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
          const videos = await Promise.all(videoPromises);
          const videoIds = videos
            .filter(att => att && att._id)
            .map((att) => {
              const id = att._id.toString();
              console.log('Adding video ID:', id, 'from attachment:', att._id);
              return id;
            });
          createDirectSaleDto.videos = videoIds;
          console.log('Videos IDs set (count:', videoIds.length, '):', createDirectSaleDto.videos);
          if (videoIds.length === 0 && videoFiles.length > 0) {
            console.error('WARNING: No valid video IDs were extracted from', videos.length, 'attachments');
            console.error('Attachment details:', videos.map(a => ({
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

    // Final validation before creating direct sale
    console.log('Final direct sale DTO before service call:', {
      title: createDirectSaleDto.title,
      thumbsCount: createDirectSaleDto.thumbs?.length || 0,
      thumbs: createDirectSaleDto.thumbs,
      videosCount: createDirectSaleDto.videos?.length || 0,
      videos: createDirectSaleDto.videos
    });

    if (!createDirectSaleDto.owner) {
      createDirectSaleDto.owner = userId;
    }

    return this.directSaleService.create(createDirectSaleDto);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update a direct sale' })
  async update(
    @Param('id') id: string,
    @Body() updateDirectSaleDto: UpdateDirectSaleDto,
  ) {
    return this.directSaleService.update(id, updateDirectSaleDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete a direct sale' })
  async remove(@Param('id') id: string) {
    await this.directSaleService.delete(id);
    return { message: 'Direct sale deleted successfully' };
  }

  @Post('purchase')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Purchase a direct sale item' })
  async purchase(
    @Request() req: ProtectedRequest,
    @Body() purchaseDto: PurchaseDirectSaleDto,
  ) {
    const userId = req.session?.user?._id?.toString();
    if (!userId) {
      throw new Error('User ID not found in session. Cannot make purchase.');
    }

    return this.directSaleService.purchase(purchaseDto, userId);
  }

  @Post('purchase/:purchaseId/confirm')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Confirm a purchase (seller action)' })
  async confirmPurchase(
    @Request() req: ProtectedRequest,
    @Param('purchaseId') purchaseId: string,
  ) {
    const userId = req.session?.user?._id?.toString();
    if (!userId) {
      throw new Error('User ID not found in session.');
    }

    return this.directSaleService.confirmPurchase(purchaseId, userId);
  }
}

