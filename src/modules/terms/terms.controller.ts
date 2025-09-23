import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TermsService } from './terms.service';
import { CreateTermsDto, UpdateTermsDto } from './dto/terms.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { AdminGuard } from 'src/common/guards/admin.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { ProtectedRequest, PublicRequest } from '../../types/request.type';

@ApiTags('terms')
@Controller('terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create new terms and conditions (Admin only)' })
  @ApiResponse({ status: 201, description: 'Terms created successfully' })
  async create(
    @Request() request: ProtectedRequest,
    @Body() createTermsDto: CreateTermsDto,
  ) {
    return this.termsService.create(createTermsDto, request.session.user._id.toString());
  }

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get all terms and conditions (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all terms' })
  async findAll() {
    return this.termsService.findAll();
  }

  // PUBLIC ENDPOINTS - No authentication required
  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Get all terms and conditions (Public access)' })
  @ApiResponse({ status: 200, description: 'List of terms' })
  async findPublic() {
    return this.termsService.findAll();
  }

  @Get('latest')
  @Public()
  @ApiOperation({ summary: 'Get latest terms and conditions (Public access)' })
  @ApiResponse({ status: 200, description: 'Latest terms' })
  @ApiResponse({ status: 404, description: 'No terms found' })
  async findLatest() {
    return this.termsService.findLatest();
  }

  @Get(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get terms by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Terms found' })
  @ApiResponse({ status: 404, description: 'Terms not found' })
  async findOne(@Param('id') id: string) {
    return this.termsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update terms and conditions (Admin only)' })
  @ApiResponse({ status: 200, description: 'Terms updated successfully' })
  @ApiResponse({ status: 404, description: 'Terms not found' })
  async update(
    @Request() request: ProtectedRequest,
    @Param('id') id: string,
    @Body() updateTermsDto: UpdateTermsDto,
  ) {
    return this.termsService.update(id, updateTermsDto, request.session.user._id.toString());
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Delete terms and conditions (Admin only)' })
  @ApiResponse({ status: 200, description: 'Terms deleted successfully' })
  @ApiResponse({ status: 404, description: 'Terms not found' })
  async remove(@Param('id') id: string) {
    await this.termsService.remove(id);
    return { message: 'Terms deleted successfully' };
  }
}