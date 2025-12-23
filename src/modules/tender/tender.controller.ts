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
  Req,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
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
import { ConfigService } from '@nestjs/config';

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

@ApiTags('Tenders')
@Controller('tender')
export class TenderController {
  private readonly baseUrl: string;

  constructor(
    private readonly tenderService: TenderService,
    private readonly attachmentService: AttachmentService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
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
  async findAll() {
    const tenders = await this.tenderService.findAll();
    console.log('Tenders with populated attachments:', tenders.map(tender => ({
      id: tender._id,
      attachments: tender.attachments,
    })));
    return tenders.map((tender) => {
      const tenderData = JSON.parse(JSON.stringify(tender));

      // Ensure evaluationType is always present (default to MOINS_DISANT for old tenders)
      if (!tenderData.evaluationType) {
        tenderData.evaluationType = 'MOINS_DISANT';
      }

      return {
        ...tenderData,
        attachments: transformAttachment(tender.attachments, this.baseUrl),
        category: tender.category ? {
          ...JSON.parse(JSON.stringify(tender.category)),
          thumb: transformAttachment(tender.category.thumb, this.baseUrl),
        } : null,
      };
    });
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

  @Post('check-all-auto-award')
  @Public()
  async checkAllTendersForAutoAward() {
    try {
      await this.tenderService.checkAllTendersForAutoAward();
      return {
        success: true,
        message: 'All tenders checked for automatic awarding'
      };
    } catch (error) {
      console.error('Error checking tenders for auto-award:', error);
      return {
        success: false,
        message: 'Error checking tenders for auto-award',
        error: error.message
      };
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

      const tenderData = JSON.parse(JSON.stringify(tender));

      // Ensure evaluationType is always present (default to MOINS_DISANT for old tenders)
      if (!tenderData.evaluationType) {
        tenderData.evaluationType = 'MOINS_DISANT';
        console.log('⚠️ Tender missing evaluationType, defaulting to MOINS_DISANT');
      }

      console.log('✅ Tender evaluation type:', tenderData.evaluationType);

      return {
        ...tenderData,
        attachments: transformAttachment(tender.attachments, this.baseUrl),
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
    console.log('TenderController.create - Session User ID:', userId);

    if (!userId) {
      console.error('TenderController.create - No User ID in Session!', { session: req.session });
      throw new Error('User ID not found in session. Cannot create tender.');
    }

    if (!rawData) {
      console.error('TenderController.create - No "data" field in body!');
      throw new Error('Missing "data" field in request body');
    }

    console.log('Creating tender with data:', rawData);
    console.log('Uploaded files count:', files?.length || 0);

    let createTenderDto: CreateTenderDto;
    try {
      createTenderDto = JSON.parse(rawData);
    } catch (e) {
      console.error('TenderController.create - JSON Parse Error:', e.message);
      throw new Error('Invalid JSON format in "data" field');
    }

    // Initialize attachments array
    if (!createTenderDto.attachments) {
      createTenderDto.attachments = [];
    }

    console.log('📋 CreateTenderDto parsed:', {
      title: createTenderDto.title,
      tenderType: createTenderDto.tenderType,
      auctionType: createTenderDto.auctionType,
      evaluationType: createTenderDto.evaluationType,
      hasEvaluationType: !!createTenderDto.evaluationType
    });

    if (files && files.length > 0) {
      // Log all file fieldnames to debug
      const allFieldnames = [...new Set(files.map(f => f.fieldname))];
      console.log('All unique fieldnames received:', allFieldnames);

      // Filter files - handle both 'attachments[]' and 'attachments'
      let attachmentFiles = files.filter(file => {
        const isAttachmentsField = file.fieldname === 'attachments[]' ||
          file.fieldname === 'attachments' ||
          file.fieldname.startsWith('attachments');
        return isAttachmentsField;
      });

      // Fallback: if no files found with attachments fieldname, use all files
      if (attachmentFiles.length === 0) {
        console.warn('No files found with attachments fieldname, using all files...');
        attachmentFiles = files;
      }

      console.log('Filtered attachment files:', attachmentFiles.length);
      console.log('Attachment file details:', attachmentFiles.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype })));

      try {
        const attachmentPromises = attachmentFiles.map(async (file) => {
          try {
            console.log('Uploading attachment file:', file.originalname);
            const att = await this.attachmentService.upload(
              file,
              AttachmentAs.BID, // Reusing the same attachment type
              userId,
            );
            console.log('Attachment created:', att._id, att.url);
            return att;
          } catch (error) {
            console.error('Error uploading attachment file:', file.originalname, error);
            throw error;
          }
        });
        const attachments = await Promise.all(attachmentPromises);
        const attachmentIds = attachments
          .filter(att => att && att._id)
          .map((att) => {
            const id = att._id.toString();
            console.log('Adding attachment ID:', id, 'from attachment:', att._id);
            return id;
          });
        createTenderDto.attachments = attachmentIds;
        console.log('Attachments IDs set (count:', attachmentIds.length, '):', createTenderDto.attachments);
        if (attachmentIds.length === 0 && attachmentFiles.length > 0) {
          console.error('WARNING: No valid attachment IDs were extracted from', attachments.length, 'attachments');
          console.error('Attachment details:', attachments.map(a => ({
            hasId: !!a?._id,
            id: a?._id?.toString(),
            url: a?.url
          })));
        }
      } catch (error) {
        console.error('Error processing attachment uploads:', error);
        throw new Error(`Failed to upload attachments: ${error.message}`);
      }
    } else {
      console.warn('No files received in the request');
    }

    // Final validation before creating tender
    console.log('Final tender DTO before service call:', {
      title: createTenderDto.title,
      attachmentsCount: createTenderDto.attachments?.length || 0,
      attachments: createTenderDto.attachments
    });

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
      throw new BadRequestException('User ID not found in session. Cannot create tender bid.');
    }

    // Validate required fields based on tender evaluation type
    const tender = await this.tenderService.findOne(tenderId);
    const isMieuxDisant = tender.evaluationType === 'MIEUX_DISANT';

    console.log('🔍 [TenderController] Bid validation:', {
      tenderId,
      evaluationType: tender.evaluationType,
      isMieuxDisant,
      bidAmount: createTenderBidDto.bidAmount,
      hasProposal: !!createTenderBidDto.proposal,
      proposalLength: createTenderBidDto.proposal?.length
    });

    if (isMieuxDisant) {
      // For MIEUX_DISANT: Proposal is required, bidAmount can be 0
      if (!createTenderBidDto.proposal || createTenderBidDto.proposal.trim().length < 10) {
        throw new BadRequestException('Une proposition détaillée est requise (minimum 10 caractères)');
      }
    } else {
      // For MOINS_DISANT: Bid amount must be positive
      if (!createTenderBidDto.bidAmount || createTenderBidDto.bidAmount <= 0) {
        throw new BadRequestException('Le montant de l\'offre doit être un nombre positif');
      }
    }

    // Set the bidder from the authenticated user
    createTenderBidDto.bidder = userId;

    // Set tender owner (already fetched above for validation)
    if (!tender.owner || !tender.owner._id) {
      throw new BadRequestException('Tender owner not found');
    }
    createTenderBidDto.tenderOwner = tender.owner._id.toString();

    console.log('Controller - Final DTO before service call:', createTenderBidDto);

    return this.tenderService.createTenderBid(tenderId, createTenderBidDto, isMieuxDisant);
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

  // Debug endpoint to check tender data
  @Get(':id/debug')
  @Public()
  async debugTender(@Param('id') id: string) {
    try {
      const tender = await this.tenderService.findOne(id);
      return {
        success: true,
        data: {
          _id: tender._id,
          title: tender.title,
          status: tender.status,
          endingAt: tender.endingAt,
          owner: tender.owner
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Accept a tender bid
   */
  @Post('bids/:bidId/accept')
  @UseGuards(AuthGuard)
  async acceptTenderBid(
    @Param('bidId') bidId: string,
    @Req() req: ProtectedRequest,
  ) {
    try {
      console.log('TenderController: Accepting tender bid:', { bidId, userId: req.session?.user?._id });

      const userId = req.session?.user?._id?.toString();
      if (!userId) {
        throw new BadRequestException('User ID not found in session');
      }

      const result = await this.tenderService.acceptTenderBid(bidId, userId);
      console.log('TenderController: Tender bid accepted successfully:', result._id);
      return result;
    } catch (error) {
      console.error('TenderController: Error accepting tender bid:', error);
      throw error;
    }
  }

  /**
   * Reject a tender bid
   */
  @Post('bids/:bidId/reject')
  @UseGuards(AuthGuard)
  async rejectTenderBid(
    @Param('bidId') bidId: string,
    @Req() req: ProtectedRequest,
  ) {
    try {
      console.log('TenderController: Rejecting tender bid:', { bidId, userId: req.session?.user?._id });

      const userId = req.session?.user?._id?.toString();
      if (!userId) {
        throw new BadRequestException('User ID not found in session');
      }

      const result = await this.tenderService.rejectTenderBid(bidId, userId);
      console.log('TenderController: Tender bid rejected successfully:', result._id);
      return result;
    } catch (error) {
      console.error('TenderController: Error rejecting tender bid:', error);
      throw error;
    }
  }

  /**
   * Delete a tender bid
   */
  @Delete('bids/:bidId')
  @UseGuards(AuthGuard)
  async deleteTenderBid(
    @Param('bidId') bidId: string,
    @Req() req: ProtectedRequest,
  ) {
    try {
      console.log('TenderController: Deleting tender bid:', { bidId, userId: req.session?.user?._id });

      const userId = req.session?.user?._id?.toString();
      if (!userId) {
        throw new BadRequestException('User ID not found in session');
      }

      const result = await this.tenderService.deleteTenderBid(bidId, userId);
      console.log('TenderController: Tender bid deleted successfully:', result._id);
      return result;
    } catch (error) {
      console.error('TenderController: Error deleting tender bid:', error);
      throw error;
    }
  }

  @Delete(':tenderId')
  @UseGuards(AuthGuard)
  async deleteTender(
    @Param('tenderId') tenderId: string,
    @Req() req: ProtectedRequest,
  ) {
    try {
      console.log('TenderController: Deleting tender:', { tenderId, userId: req.session?.user?._id });

      const userId = req.session?.user?._id?.toString();
      if (!userId) {
        throw new BadRequestException('User ID not found in session');
      }

      const result = await this.tenderService.deleteTender(tenderId, userId);
      console.log('TenderController: Tender deleted successfully:', result._id);
      return result;
    } catch (error) {
      console.error('TenderController: Error deleting tender:', error);
      throw error;
    }
  }
}
