import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AutoBidService } from './auto-bid.service';
import { CreateAutoBidDto } from './dto/create-auto-bid.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ProtectedRequest } from 'src/types/request.type';

@ApiTags('Auto Bids')
@Controller('auto-bid')
@UseGuards(AuthGuard)
export class AutoBidController {
  constructor(private readonly autoBidService: AutoBidService) {
    console.log('✅ AutoBidController loaded successfully');
    console.log('🔗 Routes: POST /auto-bid/:bidId, GET /auto-bid/test, GET /auto-bid/user/:userId, DELETE /auto-bid/:bidId/user/:userId');
  }

  @Get('test')
  @ApiOperation({ summary: 'Test endpoint to verify auto-bid controller is working' })
  async test() {
    return { message: 'Auto-bid controller is working!' };
  }

  @Get('auction/:bidId/user')
  @ApiOperation({ summary: 'Get auto-bid for specific user and auction' })
  @ApiResponse({ status: 200, description: 'Auto-bid found' })
  @ApiResponse({ status: 404, description: 'Auto-bid not found' })
  async getAutoBidByAuctionAndUser(
    @Param('bidId') bidId: string,
    @Req() request: ProtectedRequest,
  ) {
    try {
      console.log('AutoBidController: Getting auto-bid for bidId:', bidId);
      console.log('AutoBidController: User ID:', request.session.user._id);

      const autoBid = await this.autoBidService.getAutoBidByUserAndBid(
        request.session.user._id.toString(),
        bidId
      );

      if (autoBid) {
        console.log('AutoBidController: Auto-bid found:', autoBid);
        return {
          success: true,
          data: autoBid
        };
      } else {
        console.log('AutoBidController: No auto-bid found for this user and auction');
        return {
          success: false,
          data: null
        };
      }
    } catch (error) {
      console.error('AutoBidController: Error getting auto-bid:', error);
      throw new HttpException(
        error.message || 'Failed to get auto-bid',
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':bidId')
  @ApiOperation({ summary: 'Create or update auto-bid for an auction' })
  @ApiResponse({ status: 201, description: 'Auto-bid created or updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createOrUpdateAutoBid(
    @Param('bidId') bidId: string,
    @Body() createAutoBidDto: CreateAutoBidDto,
    @Req() request: ProtectedRequest,
  ) {
    try {
      console.log('AutoBidController: Received request for bidId:', bidId);
      console.log('AutoBidController: Request body:', createAutoBidDto);
      console.log('AutoBidController: User from request:', request.session.user._id);

      // Ensure the user can only create auto-bid for themselves
      if (createAutoBidDto.user !== request.session.user._id.toString()) {
        throw new HttpException('Unauthorized: You can only create auto-bids for yourself', HttpStatus.UNAUTHORIZED);
      }

      // Set the bid ID from the URL parameter
      createAutoBidDto.bid = bidId;

      const result = await this.autoBidService.createOrUpdateAutoBid(createAutoBidDto);
      console.log('AutoBidController: Auto-bid saved successfully:', result);
      
      return {
        success: true,
        message: 'Auto-bid saved successfully',
        data: result
      };
    } catch (error) {
      console.error('AutoBidController: Error:', error);
      throw new HttpException(
        error.message || 'Failed to save auto-bid',
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all auto-bids for a user' })
  async getAutoBidsByUser(@Param('userId') userId: string) {
    try {
      const autoBids = await this.autoBidService.getAutoBidsByUser(userId);
      return {
        success: true,
        data: autoBids
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get auto-bids',
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get(':bidId/user/:userId')
  @ApiOperation({ summary: 'Get specific auto-bid for user and auction' })
  async getAutoBidByUserAndBid(
    @Param('bidId') bidId: string,
    @Param('userId') userId: string,
  ) {
    try {
      const autoBid = await this.autoBidService.getAutoBidByUserAndBid(userId, bidId);
      return {
        success: true,
        data: autoBid
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get auto-bid',
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':bidId/user/:userId')
  @ApiOperation({ summary: 'Delete auto-bid for user and auction' })
  async deleteAutoBid(
    @Param('bidId') bidId: string,
    @Param('userId') userId: string,
  ) {
    try {
      await this.autoBidService.deleteAutoBid(userId, bidId);
      return {
        success: true,
        message: 'Auto-bid deleted successfully'
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete auto-bid',
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }
} 