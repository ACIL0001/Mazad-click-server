import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UploadedFile,
  Request,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AdsService } from './ads.service';
import { Ad } from './schema/ads.schema';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { AttachmentService } from '../attachment/attachment.service';
import { AttachmentAs } from '../attachment/schema/attachment.schema';
import { ConfigService } from '@nestjs/config';

// Helper to transform attachment to minimal shape
function transformAttachment(att, baseUrl?: string) {
  if (!att) return null;
  
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
  
  if (!att.url) return null;
  const fullUrl = att.fullUrl || `${apiBase}${att.url}`;
  return {
    url: att.url,
    fullUrl: fullUrl,
    _id: att._id,
    filename: att.filename
  };
}

@ApiTags('Ads')
@Controller('ads')
export class AdsController {
  private readonly baseUrl: string;

  constructor(
    private readonly adsService: AdsService,
    private readonly attachmentService: AttachmentService,
    private readonly configService: ConfigService,
  ) {
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

  @Post()
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  @ApiOperation({ summary: 'Create a new ad' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
        title: { type: 'string' },
        url: { type: 'string' },
        isActive: { type: 'boolean' },
        isDisplayed: { type: 'boolean' },
        order: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Ad created successfully', type: Ad })
  async create(
    @UploadedFile() image: Express.Multer.File,
    @Body('title') title: string,
    @Body('url') url: string,
    @Request() req,
    @Body('isActive') isActive?: string,
    @Body('isDisplayed') isDisplayed?: string,
    @Body('order') order?: string,
  ) {
    try {
      if (!image) {
        throw new BadRequestException('Image is required');
      }

      if (!title || !url) {
        throw new BadRequestException('Title and URL are required');
      }

      const userId = req.session?.user?._id || null;
      const attachment = await this.attachmentService.upload(image, AttachmentAs.AD, userId);
      
      const createAdDto: CreateAdDto = {
        title,
        url,
        image: String(attachment._id),
        isActive: isActive === 'true' || isActive === undefined,
        isDisplayed: isDisplayed === 'true' || false,
        order: order ? parseInt(order, 10) : 0,
      };

      const ad = await this.adsService.create(createAdDto);
      return {
        ...JSON.parse(JSON.stringify(ad)),
        image: transformAttachment(ad.image, this.baseUrl),
      };
    } catch (err) {
      console.error('Error in ad creation:', err);
      throw err;
    }
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all ads' })
  @ApiResponse({
    status: 200,
    description: 'List of all ads',
    type: [Ad],
  })
  async findAll(): Promise<any[]> {
    const ads = await this.adsService.findAll();
    return ads.map(ad => ({
      ...JSON.parse(JSON.stringify(ad)),
      image: transformAttachment(ad.image, this.baseUrl),
    }));
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get an ad by ID' })
  @ApiParam({ name: 'id', description: 'Ad ID' })
  @ApiResponse({ status: 200, description: 'Ad found', type: Ad })
  @ApiResponse({ status: 404, description: 'Ad not found' })
  async findOne(@Param('id') id: string): Promise<any> {
    const ad = await this.adsService.findOne(id);
    return {
      ...JSON.parse(JSON.stringify(ad)),
      image: transformAttachment(ad.image, this.baseUrl),
    };
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  @ApiOperation({ summary: 'Update an ad' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Ad ID' })
  @ApiResponse({
    status: 200,
    description: 'Ad updated successfully',
    type: Ad,
  })
  @ApiResponse({ status: 404, description: 'Ad not found' })
  async update(
    @Param('id') id: string,
    @UploadedFile() image: Express.Multer.File,
    @Request() req,
    @Body('title') title?: string,
    @Body('url') url?: string,
    @Body('isActive') isActive?: string,
    @Body('isDisplayed') isDisplayed?: string,
    @Body('order') order?: string,
  ): Promise<any> {
    try {
      const updateAdDto: UpdateAdDto = {};

      if (title !== undefined) updateAdDto.title = title;
      if (url !== undefined) updateAdDto.url = url;
      if (isActive !== undefined) updateAdDto.isActive = isActive === 'true';
      if (isDisplayed !== undefined) updateAdDto.isDisplayed = isDisplayed === 'true';
      if (order !== undefined) updateAdDto.order = parseInt(order, 10);

      if (image) {
        const userId = req.session?.user?._id || null;
        const attachment = await this.attachmentService.upload(image, AttachmentAs.AD, userId);
        updateAdDto.image = String(attachment._id);
      }

      const ad = await this.adsService.update(id, updateAdDto);
      return {
        ...JSON.parse(JSON.stringify(ad)),
        image: transformAttachment(ad.image, this.baseUrl),
      };
    } catch (err) {
      console.error('Error in ad update:', err);
      throw err;
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update an ad' })
  @ApiParam({ name: 'id', description: 'Ad ID' })
  @ApiResponse({
    status: 200,
    description: 'Ad updated successfully',
    type: Ad,
  })
  @ApiResponse({ status: 404, description: 'Ad not found' })
  async patch(
    @Param('id') id: string,
    @Body() updateAdDto: UpdateAdDto
  ): Promise<any> {
    const ad = await this.adsService.update(id, updateAdDto);
    return {
      ...JSON.parse(JSON.stringify(ad)),
      image: transformAttachment(ad.image, this.baseUrl),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an ad' })
  @ApiParam({ name: 'id', description: 'Ad ID' })
  @ApiResponse({
    status: 200,
    description: 'Ad deleted successfully',
    type: Ad,
  })
  @ApiResponse({ status: 404, description: 'Ad not found' })
  async remove(@Param('id') id: string): Promise<Ad> {
    return this.adsService.remove(id);
  }

  @Patch(':id/display')
  @ApiOperation({ summary: 'Toggle display status of an ad' })
  @ApiParam({ name: 'id', description: 'Ad ID' })
  @ApiResponse({
    status: 200,
    description: 'Display status updated successfully',
    type: Ad,
  })
  @ApiResponse({ status: 404, description: 'Ad not found' })
  async toggleDisplay(
    @Param('id') id: string,
    @Body('isDisplayed') isDisplayed: boolean
  ): Promise<any> {
    const ad = await this.adsService.toggleDisplay(id, isDisplayed);
    return {
      ...JSON.parse(JSON.stringify(ad)),
      image: transformAttachment(ad.image, this.baseUrl),
    };
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Toggle active status of an ad' })
  @ApiParam({ name: 'id', description: 'Ad ID' })
  @ApiResponse({
    status: 200,
    description: 'Active status updated successfully',
    type: Ad,
  })
  @ApiResponse({ status: 404, description: 'Ad not found' })
  async toggleActive(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean
  ): Promise<any> {
    const ad = await this.adsService.toggleActive(id, isActive);
    return {
      ...JSON.parse(JSON.stringify(ad)),
      image: transformAttachment(ad.image, this.baseUrl),
    };
  }

  @Patch('order')
  @ApiOperation({ summary: 'Bulk update order for multiple ads' })
  @ApiResponse({
    status: 200,
    description: 'Order updated successfully',
    type: [Ad],
  })
  async updateOrder(
    @Body('ads') ads: { _id: string; order: number }[]
  ): Promise<any[]> {
    if (!Array.isArray(ads)) {
      throw new BadRequestException('ads must be an array');
    }
    const updatedAds = await this.adsService.updateOrder(ads);
    return updatedAds.map(ad => ({
      ...JSON.parse(JSON.stringify(ad)),
      image: transformAttachment(ad.image, this.baseUrl),
    }));
  }
}

