import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
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
  constructor(private readonly offerService: OfferService) {}

  /**
   * Get all offers for a specific user (owner)
   * @returns An array of offers
   */
  @Post('all')
  async getAllOffers(@Body('data') data: any) {
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
  @UseGuards(SellerGuard)
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
   * @param id - The ID of the bid
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
}
