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
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { TenderService } from './tender.service';
import { CreateTenderDto } from './dto/create-tender.dto';
import { UpdateTenderDto } from './dto/update-tender.dto';
import { CreateTenderBidDto } from './dto/create-tender-bid.dto';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { AttachmentService } from '../attachment/attachment.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ProtectedRequest } from 'src/types/request.type';
import { AttachmentAs } from '../attachment/schema/attachment.schema';
import { UserService } from '../user/user.service';

// Helper to transform attachment(s) to minimal shape
function transformAttachment(att) {
  if (!att) return null;
  if (Array.isArray(att)) {
    return att.filter(Boolean).map(a => a && a.url ? ({ url: a.url, _id: a._id, filename: a.filename }) : null).filter(Boolean);
  }
  return att.url ? { url: att.url, _id: att._id, filename: att.filename } : null;
}

@ApiTags('Tenders')
@Controller('tender')
export class TenderController {
  constructor(
    private readonly tenderService: TenderService,
    private readonly attachmentService: AttachmentService,
    private readonly userService: UserService,
  ) {}

  @Get()
  @Public()
  async findAll() {
    const tenders = await this.tenderService.findAll();
    console.log('Tenders with populated attachments:', tenders.map(tender => ({
      id: tender._id,
      attachments: tender.attachments,
    })));
    return tenders.map((tender) => ({
      ...JSON.parse(JSON.stringify(tender)),
      attachments: transformAttachment(tender.attachments),
    }));
  }

  @Get('health')
  @Public()
  async healthCheck() {
    return {
      status: 'ok',
      message: 'Tender service is running',
      timestamp: new Date().toISOString()
    };
  }

  @Get('my-tenders')
  @UseGuards(AuthGuard)
  findMyTenders(@Request() request: ProtectedRequest) {
    return this.tenderService.findByOwner(request.session.user._id.toString());
  }

  @Post('check')
  async checkTendersToUser(@Body('id') id: any) {
    let result = this.tenderService.checkTenders(id);
    return {
      message: 'done',
      result
    }
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    try {
      const tender = await this.tenderService.findOne(id);
      let awardedUser: any = null;
      
      if (tender.awardedTo) {
        try {
          const getUser = await this.userService.getUserById(tender.awardedTo.toString());
          awardedUser = getUser;
        } catch (userError) {
          console.error('Error fetching awarded user:', userError);
          // Continue without the user data if there's an error
        }
      }
      
      console.log('awardedUser:', awardedUser);
      
      return {
        ...JSON.parse(JSON.stringify(tender)),
        attachments: transformAttachment(tender.attachments),
        awardedUser: awardedUser
      };
    } catch (error) {
      console.error('Error in findOne:', error);
      throw error;
    }
  }

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FilesInterceptor('attachments[]', undefined, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'JSON string of tender details (CreateTenderDto)',
        },
        'attachments[]': {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Array of attachment files for the tender. Field name: attachments[]',
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
      throw new Error('User ID not found in session. Cannot create tender.');
    }

    console.log('Creating tender with data:', rawData);

    const createTenderDto: CreateTenderDto = JSON.parse(rawData);

    if (files && files.length > 0) {
      const attachmentPromises = files.map(async (file) => {
        const att = await this.attachmentService.upload(
          file,
          AttachmentAs.BID, // Reusing the same attachment type
          userId,
        );
        return att;
      });
      const attachments = await Promise.all(attachmentPromises);
      createTenderDto.attachments = attachments.map((att) => att._id.toString());
    }

    if (!createTenderDto.owner) {
      createTenderDto.owner = userId;
    }

    return this.tenderService.create(createTenderDto);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  update(@Param('id') id: string, @Body() updateTenderDto: UpdateTenderDto) {
    return this.tenderService.update(id, updateTenderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenderService.remove(id);
  }

  // Tender bid endpoints
  @Post(':id/bid')
  @UseGuards(AuthGuard)
  async createTenderBid(
    @Param('id') tenderId: string,
    @Body() createTenderBidDto: CreateTenderBidDto,
    @Request() req: ProtectedRequest,
  ) {
    const userId = req.session?.user?._id?.toString();
    if (!userId) {
      throw new Error('User ID not found in session. Cannot create tender bid.');
    }

    // Set the bidder from the authenticated user
    createTenderBidDto.bidder = userId;

    // Get tender owner
    const tender = await this.tenderService.findOne(tenderId);
    createTenderBidDto.tenderOwner = tender.owner._id.toString();

    return this.tenderService.createTenderBid(tenderId, createTenderBidDto);
  }

  @Get(':id/bids')
  @Public()
  async getTenderBids(@Param('id') tenderId: string) {
    return this.tenderService.getTenderBidsByTenderId(tenderId);
  }

  @Get('owner/:ownerId/bids')
  @UseGuards(AuthGuard)
  async getTenderBidsByOwner(@Param('ownerId') ownerId: string) {
    return this.tenderService.getTenderBidsByOwnerId(ownerId);
  }

  @Get('bidder/:bidderId/bids')
  @UseGuards(AuthGuard)
  async getTenderBidsByBidder(@Param('bidderId') bidderId: string) {
    return this.tenderService.getTenderBidsByBidderId(bidderId);
  }
}
