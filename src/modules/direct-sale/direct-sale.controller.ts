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

// Helper to transform attachment(s) to minimal shape
function transformAttachment(att) {
  if (!att) return null;
  if (Array.isArray(att)) {
    return att
      .filter(Boolean)
      .map((a) =>
        a && a.url ? { url: a.url, _id: a._id, filename: a.filename } : null,
      )
      .filter(Boolean);
  }
  return att.url ? { url: att.url, _id: att._id, filename: att.filename } : null;
}

@ApiTags('Direct Sales')
@Controller('direct-sale')
export class DirectSaleController {
  constructor(
    private readonly directSaleService: DirectSaleService,
    private readonly attachmentService: AttachmentService,
  ) { }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all active direct sales' })
  async findAll() {
    const directSales = await this.directSaleService.findAll();
    return directSales.map((directSale) => ({
      ...JSON.parse(JSON.stringify(directSale)),
      thumbs: transformAttachment(directSale.thumbs),
      videos: transformAttachment(directSale.videos),
    }));
  }

  @Get('admin/all')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all direct sales for admin' })
  async findAllForAdmin() {
    const directSales = await this.directSaleService.findAllForAdmin();
    return directSales.map((directSale) => ({
      ...JSON.parse(JSON.stringify(directSale)),
      thumbs: transformAttachment(directSale.thumbs),
      videos: transformAttachment(directSale.videos),
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
  async findOne(@Param('id') id: string) {
    try {
      const directSale = await this.directSaleService.findOne(id);
      return {
        ...JSON.parse(JSON.stringify(directSale)),
        thumbs: transformAttachment(directSale.thumbs),
        videos: transformAttachment(directSale.videos),
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

    const createDirectSaleDto: CreateDirectSaleDto = JSON.parse(rawData);

    if (files && files.length > 0) {
      const thumbPromises = files
        .filter((file) => file.mimetype.startsWith('image/'))
        .map(async (file) => {
          const att = await this.attachmentService.upload(
            file,
            AttachmentAs.BID,
            userId,
          );
          return att;
        });
      const thumbs = await Promise.all(thumbPromises);

      const videoPromises = files
        .filter((file) => file.mimetype.startsWith('video/'))
        .map(async (file) => {
          const att = await this.attachmentService.upload(
            file,
            AttachmentAs.BID,
            userId,
          );
          return att;
        });
      const videos = await Promise.all(videoPromises);

      createDirectSaleDto.thumbs = thumbs.map((att) => att._id.toString());
      createDirectSaleDto.videos = videos.map((att) => att._id.toString());
    }

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

