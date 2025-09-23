import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Offer, OfferDocument, OfferStatus } from './schema/offer.schema';
import { CreateOfferDto } from './dto/create-offer.dto';
import { BidService } from './bid.service';
import { AutoBidService } from './auto-bid.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';
import { I18nService } from 'nestjs-i18n';
import { BID_TYPE } from './schema/bid.schema';

@Injectable()
export class OfferService {
  constructor(
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
    @Inject(forwardRef(() => BidService)) // Fix: Add forwardRef wrapper here
    private bidService: BidService,
    private autoBidService: AutoBidService,
    private notificationService: NotificationService,
    private i18nService: I18nService,
  ) {}

  async createOffer(bidId: string, createOfferDto: CreateOfferDto): Promise<Offer> {
    console.log("Creating new offer");
    const bid = await this.bidService.findOne(bidId);
    console.log("Found bid:", bid._id);

    // Determine the bid type
    const bidType = bid.bidType;

    // Check if the offer price is valid based on bid type
    if ((bidType === BID_TYPE.PRODUCT && createOfferDto.price <= bid.currentPrice) ||
        (bidType === BID_TYPE.SERVICE && createOfferDto.price >= bid.currentPrice)) {
      const translatedMessage = await this.i18nService.t('OFFER.INVALID_PRICE');
      throw new BadRequestException(translatedMessage);
    }

    // Create the offer with a default status
    const createdOffer = new this.offerModel({ 
      ...createOfferDto, 
      bid: bidId,
      status: OfferStatus.PENDING
    });
    const savedOffer = await createdOffer.save();
    console.log("Offer created:", savedOffer._id);

    // Update the bid's current price
    const updatedBid = await this.bidService.update(bid._id, { currentPrice: createOfferDto.price });
    console.log("Bid price updated");

    // Create notification for bid owner
    const bidOwnerTitle = "Nouvelle offre reçue";
    const bidOwnerMessage = `Une nouvelle offre de ${createOfferDto.price} a été placée sur votre enchère ${bid.title}`;

    // Check if bid.owner exists and has _id before trying to access it
    if (bid.owner && bid.owner._id) {
      console.log("Creating notification for bid owner:", bid.owner._id.toString());
      await this.notificationService.create(
        bid.owner._id.toString(),
        NotificationType.NEW_OFFER,
        bidOwnerTitle,
        bidOwnerMessage,
        { bid: updatedBid, offer: savedOffer }
      );
    } else {
      console.log("Warning: Bid owner is null or missing _id, skipping notification");
      // If needed, you could try to find the owner from the bid's owner field directly
      // const ownerId = bid.owner ? (typeof bid.owner === 'string' ? bid.owner : null) : null;
    }

    // Auto bid logic here...
    // (keeping your existing auto bid logic)

    return savedOffer;
  }

  /**
   * Get offers by bid ID
   */
  async getOffersByBidId(bidId: string): Promise<Offer[]> {
    return this.offerModel
      .find({ bid: bidId })
      .populate('user', 'firstName lastName phone email username')
      .populate('bid', 'title currentPrice category')
      .lean()
      .exec();
  }

  /**
   * Get offers for auctions created by a specific seller (auction owner)
   */
  async getOffersBySellerId(sellerId: string): Promise<Offer[]> {
    // Find all bids created by the seller
    const bids = await this.bidService.findByOwner(sellerId);
    const bidIds = bids.map(bid => bid._id);

    // Find all offers associated with these bid IDs
    return this.offerModel
      .find({ bid: { $in: bidIds } })
      .populate('user', 'firstName lastName phone email username')
      .populate('bid', 'title currentPrice category')
      .lean()
      .exec();
  }

  /**
   * Get offers made by a specific user (buyer)
   */
  async getOffersByUserId(userId: string): Promise<Offer[]> {
    return this.offerModel
      .find({ user: userId })
      .populate('user', 'firstName lastName phone email username')
      .populate('bid', 'title currentPrice category')
      .lean()
      .exec();
  }

  /**
   * Get offers - this should return offers where the user is either:
   * 1. The one who made the offer (buyer)
   * 2. The owner of the auction that received the offer (seller)
   */
  async getOffers(data: any): Promise<Offer[]> {
    console.log('Getting offers for user ID =', data._id);
    
    try {
      // First, let's check if there are any offers at all for debugging
      const totalOffers = await this.offerModel.countDocuments();
      console.log('Total offers in database:', totalOffers);

      // Option 1: Get offers made BY this user (as a buyer)
      const offersMadeByUser = await this.offerModel
        .find({ user: data._id })
        .populate('user', 'firstName lastName phone email username')
        .populate('bid', 'title currentPrice category owner')
        .lean()
        .exec();

      console.log('Offers made by user:', offersMadeByUser.length);

      // Option 2: Get offers made ON this user's auctions (as a seller)
      const userBids = await this.bidService.findByOwner(data._id);
      const userBidIds = userBids.map(bid => bid._id);
      
      const offersOnUserBids = await this.offerModel
        .find({ bid: { $in: userBidIds } })
        .populate('user', 'firstName lastName phone email username')
        .populate('bid', 'title currentPrice category owner')
        .lean()
        .exec();

      console.log('Offers on user\'s auctions:', offersOnUserBids.length);

      // Combine both types of offers and remove duplicates
      const allUserOffers = [...offersMadeByUser, ...offersOnUserBids];
      const uniqueOffers = allUserOffers.filter((offer, index, self) => 
        index === self.findIndex(o => o._id.toString() === offer._id.toString())
      );

      console.log('Total unique offers for user:', uniqueOffers.length);
      console.log('Sample offer data:', uniqueOffers[0]);

      return uniqueOffers;

    } catch (error) {
      console.error('Error in getOffers:', error);
      throw error;
    }
  }

  /**
   * Test method to get all offers (for debugging)
   */
  async getAllOffersForTesting(): Promise<Offer[]> {
    console.log('Service: Getting all offers for testing');
    
    const allOffers = await this.offerModel
      .find({})
      .populate('user', 'firstName lastName phone email username')
      .populate('bid', 'title currentPrice category owner')
      .lean()
      .exec();
    
    console.log('Service: Found all offers:', allOffers.length);
    
    // Log some sample data for debugging
    if (allOffers.length > 0) {
      console.log('Sample offer structure:', {
        _id: allOffers[0]._id,
        user: allOffers[0].user,
        bid: allOffers[0].bid,
        price: allOffers[0].price,
        owner: allOffers[0].owner || 'No owner field'
      });
    }
    
    return allOffers;
  }
}