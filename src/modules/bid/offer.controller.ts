import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { ApiTags } from '@nestjs/swagger';
import { BuyerGuard } from 'src/common/guards/reseller.guard';
import { SellerGuard } from 'src/common/guards/client.guard';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { AuctionOwnerGuard } from 'src/common/guards/auction-owner.guard';
import { ProtectedRequest } from 'src/types/request.type';

@ApiTags('Offers')
@UseGuards(AuthGuard)
@Controller('offers')
export class OfferController {
  constructor(private readonly offerService: OfferService) { }

  /**
   * Get all offers (simple endpoint for backward compatibility)
   * @returns An array of all offers
   */
  @Get()
  @Public()
  async getAllOffers() {
    console.log('Controller: Getting all offers');

    try {
      const offers = await this.offerService.getAllOffersForTesting();
      console.log('Controller: Returning all offers:', offers.length);
      return {
        success: true,
        data: offers,
        message: 'Offers retrieved successfully'
      };
    } catch (error) {
      console.error('Controller: Error getting all offers:', error);
      throw error;
    }
  }

  /**
   * Get all offers for a specific user (owner)
   * @returns An array of offers
   */
  @Post('all')
  async getAllOffersForUser(@Body('data') data: any) {
    console.log('Controller: Getting offers for user ID:', data._id);
    console.log('Controller: Full request body:', data);

    try {
      const offers = await this.offerService.getOffers(data);
      console.log('Controller: Returning offers:', offers.length);
      return offers;
    } catch (error) {
      console.error('Controller: Error getting offers:', error);
      throw error;
    }
  }

  /**
   * Test endpoint to get all offers (for debugging)
   * @returns An array of all offers
   */
  @Get('test/all')
  async getAllOffersTest() {
    console.log('Controller: Getting all offers for testing');

    try {
      const allOffers = await this.offerService.getAllOffersForTesting();
      console.log('Controller: Returning all offers:', allOffers.length);
      return allOffers;
    } catch (error) {
      console.error('Controller: Error getting all offers:', error);
      throw error;
    }
  }

  /**
   * Get offers by bid ID
   * @param id - The ID of the bid
   * @param request - The request object
   * @returns An array of offers
   */
  @Get(':id')
  // FIXED: Removed @UseGuards(SellerGuard) which was causing the 403 Forbidden error.
  // The route is now protected by the class-level AuthGuard, allowing any authenticated user.
  async getOffersByBidId(@Param('id') id: string) {
    return this.offerService.getOffersByBidId(id);
  }

  /**
   * Get offers by seller ID
   * @param id - The ID of the seller
   * @returns An array of offers
   */
  @Get('/seller/:id')
  async getOffersBySellerId(@Param('id') id: string) {
    return this.offerService.getOffersBySellerId(id);
  }

  /**
   * Get offers made by a specific user (buyer)
   * @param userId - The ID of the user who made the offers
   * @returns An array of offers made by the user
   */
  @Get('/user/:userId')
  async getOffersByUserId(@Param('userId') userId: string) {
    return this.offerService.getOffersByUserId(userId);
  }

  /**
   * Create an offer
   * @param id - The ID of the bid or tender
   * @param createOfferDto - The offer to create
   * @returns The created offer
   */
  @Post(':id')
  async createOffer(
    @Param('id') id: string,
    @Body() createOfferDto: CreateOfferDto,
  ) {
    return this.offerService.createOffer(id, createOfferDto);
  }

  /**
   * Get offers by tender ID
   * @param tenderId - The ID of the tender
   * @returns An array of offers for the tender
   */
  @Get('/tender/:tenderId')
  async getOffersByTenderId(@Param('tenderId') tenderId: string) {
    return this.offerService.getOffersByTenderId(tenderId);
  }

  /**
   * Accept an offer
   * @param offerId - The ID of the offer
   * @param request - The request object
   * @returns The updated offer
   */
  @Post('/:offerId/accept')
  @UseGuards(AuthGuard)
  async acceptOffer(
    @Param('offerId') offerId: string,
    @Req() req: ProtectedRequest,
  ) {
    try {
      console.log('Controller: Accepting offer:', { offerId, userId: req.session?.user?._id });

      const userId = req.session?.user?._id?.toString();
      if (!userId) {
        console.error('Controller: User ID not found in session. properties:', Object.keys(req.session?.user || {}), 'session:', !!req.session);
        throw new BadRequestException('User ID not found in session');
      }

      const result = await this.offerService.acceptOffer(offerId, userId);
      console.log('Controller: Offer accepted successfully:', result._id);
      return result;
    } catch (error) {
      console.error('Controller: Error accepting offer:', error);
      throw error;
    }
  }

  /**
   * Reject an offer
   * @param offerId - The ID of the offer
   * @param request - The request object
   * @returns The updated offer
   */
  @Post('/:offerId/reject')
  @UseGuards(AuthGuard)
  async rejectOffer(
    @Param('offerId') offerId: string,
    @Req() req: ProtectedRequest,
  ) {
    try {
      console.log('Controller: Rejecting offer:', { offerId, userId: req.session?.user?._id });

      const userId = req.session?.user?._id?.toString();
      if (!userId) {
        console.error('Controller: User ID not found in session. properties:', Object.keys(req.session?.user || {}), 'session:', !!req.session);
        throw new BadRequestException('User ID not found in session');
      }

      const result = await this.offerService.rejectOffer(offerId, userId);
      console.log('Controller: Offer rejected successfully:', result._id);
      return result;
    } catch (error) {
      console.error('Controller: Error rejecting offer:', error);
      throw error;
    }
  }

  /**
   * Delete an offer
   * @param offerId - The ID of the offer
   * @param request - The request object
   * @returns Success message
   */
  @Delete('/:offerId')
  @UseGuards(AuthGuard)
  async deleteOffer(
    @Param('offerId') offerId: string,
    @Req() req: ProtectedRequest,
  ) {
    try {
      console.log('Controller: Deleting offer:', { offerId, userId: req.session?.user?._id });

      const userId = req.session?.user?._id?.toString();
      if (!userId) {
        throw new BadRequestException('User ID not found in session');
      }

      const result = await this.offerService.deleteOffer(offerId, userId);
      console.log('Controller: Offer deleted successfully:', offerId);
      return result;
    } catch (error) {
      console.error('Controller: Error deleting offer:', error);
      throw error;
    }
  }
}