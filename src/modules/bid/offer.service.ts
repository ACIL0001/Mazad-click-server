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
import { ChatService } from '../chat/chat.service';
import { UserService } from '../user/user.service';

@Injectable()
export class OfferService {
  constructor(
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
    @Inject(forwardRef(() => BidService)) // Fix: Add forwardRef wrapper here
    private bidService: BidService,
    private autoBidService: AutoBidService,
    private notificationService: NotificationService,
    private i18nService: I18nService,
    private chatService: ChatService,
    private userService: UserService,
  ) { }

  async createOffer(bidId: string, createOfferDto: CreateOfferDto): Promise<Offer> {
    // Try to find as bid first
    let bid;
    let isTender = false;

    try {
      bid = await this.bidService.findOne(bidId);
    } catch (error) {
      // If not a bid, assume it's a tender and create a tender offer
      isTender = true;
    }

    if (isTender) {
      // Handle tender offer creation
      return this.createTenderOffer(bidId, createOfferDto);
    } else {
      // Handle regular bid offer creation
      return this.createBidOffer(bid, createOfferDto);
    }
  }

  private async createBidOffer(bid: any, createOfferDto: CreateOfferDto): Promise<Offer> {
    // Determine the bid type
    const bidType = bid.bidType;

    // Check if the offer price is valid - both PRODUCT and SERVICE auctions work the same way
    // Users must bid higher than the current price to win the auction
    if (createOfferDto.price <= bid.currentPrice) {
      const translatedMessage = await this.i18nService.t('OFFER.INVALID_PRICE');
      throw new BadRequestException(translatedMessage);
    }

    // Create the offer with a default status
    const createdOffer = new this.offerModel({
      ...createOfferDto,
      bid: bid._id,
      status: OfferStatus.PENDING
    });
    const savedOffer = await createdOffer.save();

    // Update the bid's current price
    const updatedBid = await this.bidService.update(bid._id, { currentPrice: createOfferDto.price });

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
    }

    // Send confirmation notification to bidder
    if (createOfferDto.user) {
      await this.notificationService.create(
        createOfferDto.user,
        NotificationType.NEW_OFFER,
        'Offre placée avec succès',
        `Votre offre de ${createOfferDto.price} DA a été placée avec succès sur l'enchère "${bid.title}".`,
        { bid: updatedBid, offer: savedOffer },
        bid.owner?._id?.toString(),
        `${bid.owner?.firstName || 'Unknown'} ${bid.owner?.lastName || 'User'}`,
        bid.owner?.email
      );
    }

    return savedOffer;
  }

  private async createTenderOffer(tenderId: string, createOfferDto: CreateOfferDto): Promise<Offer> {
    // For tenders, we create an offer record for tracking purposes
    // The actual tender bid logic is handled in the tender service

    // Create the offer with a default status
    const createdOffer = new this.offerModel({
      ...createOfferDto,
      bid: tenderId, // Store tender ID in bid field for compatibility
      status: OfferStatus.PENDING,
      tenderId: tenderId // Add tender ID for reference
    });
    const savedOffer = await createdOffer.save();

    // Create notification for tender owner
    const tenderOwnerTitle = "Nouvelle offre reçue";
    const tenderOwnerMessage = `Une nouvelle offre de ${createOfferDto.price} a été soumise pour votre appel d'offres`;

    // Create notification for tender owner (we'll use the owner from createOfferDto)
    if (createOfferDto.owner) {
      await this.notificationService.create(
        createOfferDto.owner,
        NotificationType.NEW_OFFER,
        tenderOwnerTitle,
        tenderOwnerMessage,
        { tenderId: tenderId, offer: savedOffer }
      );
    }

    // Send confirmation notification to provider (offer maker)
    if (createOfferDto.user) {
      await this.notificationService.create(
        createOfferDto.user,
        NotificationType.NEW_OFFER,
        'Offre soumise avec succès',
        `Votre offre de ${createOfferDto.price} DA a été soumise avec succès pour l'appel d'offres.`,
        { tenderId: tenderId, offer: savedOffer },
        createOfferDto.owner, // senderId (tender owner)
        undefined, // senderName
        undefined // senderEmail
      );
    }

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
   * Get offers by tender ID
   */
  async getOffersByTenderId(tenderId: string): Promise<Offer[]> {
    return this.offerModel
      .find({ tenderId: tenderId })
      .populate('user', 'firstName lastName phone email username')
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

  /**
   * Update offer status (accept/reject)
   */
  async updateOfferStatus(offerId: string, status: 'ACCEPTED' | 'DECLINED', ownerId: string): Promise<Offer> {
    console.log('Service: Updating offer status:', { offerId, status, ownerId });

    try {
      // Validate ObjectId format
      if (!offerId || offerId.length !== 24) {
        console.error('Service: Invalid offer ID format:', offerId);
        throw new Error('Invalid offer ID format');
      }

      // Log all offers to debug
      const allOffers = await this.offerModel.find({}).lean().exec();
      console.log('Service: All offers in database:', allOffers.map(o => ({ _id: o._id, owner: o.owner, status: o.status })));

      // Find the offer
      console.log('Service: Searching for offer with ID:', offerId);
      const offer = await this.offerModel.findById(offerId).populate('user', 'firstName lastName email').exec();
      if (!offer) {
        console.error('Service: Offer not found:', offerId);
        console.error('Service: Available offer IDs:', allOffers.map(o => o._id));
        throw new NotFoundException(`Offer with ID ${offerId} not found`);
      }

      console.log('Service: Found offer:', {
        _id: offer._id,
        owner: offer.owner,
        currentStatus: offer.status,
        price: offer.price
      });

      // Check if the user is the owner of the offer (strict check on offer document)
      let isAuthorized = false;

      // 1. Direct ownership check
      if (offer.owner && offer.owner.toString() === ownerId) {
        isAuthorized = true;
      }

      // 2. If not authorized yet, check against the parent Bid/Tender owner
      // This handles legacy data issues where offer.owner might have been set to bidder
      if (!isAuthorized) {
        console.log('Service: Direct ownership check failed, checking parent Bid/Tender...');

        // We need to fetch the bid/tender to check its owner
        // In the schema, 'bid' can be an ID or reference. For tenders, it's also stored in 'bid' often.
        if (offer.bid) {
          try {
            // Use any to bypass TS strict typing for the populated/loose check
            const parentBid = await this.bidService.findOne(offer.bid.toString());

            if (parentBid && parentBid.owner) {
              const parentOwnerId = typeof parentBid.owner === 'object' && parentBid.owner._id
                ? parentBid.owner._id.toString()
                : parentBid.owner.toString();

              if (parentOwnerId === ownerId) {
                console.log('Service: Authorized via parent Bid/Tender ownership');
                isAuthorized = true;

                // AUTO-HEAL: Update the offer owner to be correct
                offer.owner = parentBid.owner; // or ownerId, but kept safe
                // We don't save yet, it will be saved downstream
              } else {
                console.log('Service: Parent owner mismatch:', { parentOwnerId, requestingUser: ownerId });
              }
            }
          } catch (err) {
            console.warn('Service: Could not fetch parent bid for auth check:', err.message);
          }
        }
      }

      if (!isAuthorized) {
        console.error('Service: Unauthorized access attempt:', {
          offerOwner: offer.owner,
          requestingUser: ownerId
        });
        throw new ForbiddenException('Unauthorized: You can only update your own offers');
      }

      // Update the offer status using proper enum values
      const statusValue = status === 'ACCEPTED' ? OfferStatus.ACCEPTED : OfferStatus.DECLINED;
      console.log('Service: Updating status to:', statusValue);

      offer.status = statusValue;
      const updatedOffer = await offer.save();

      console.log('Service: Offer status updated successfully:', updatedOffer._id);

      // If accepted, create a chat
      let chatId = null;
      if (status === 'ACCEPTED') {
        try {
          const ownerUser = await this.userService.findOne(ownerId);
          console.log('Service: Looking up user for chat:', offer.user._id);
          const offerMakerUser = await this.userService.findOne(offer.user._id.toString());

          if (ownerUser && offerMakerUser) {
            // Prepare users in the format ChatService expects (IUser[])
            const chatUsers = [
              {
                _id: ownerUser._id.toString(),
                AccountType: ownerUser.AccountType,
                firstName: ownerUser.firstName,
                lastName: ownerUser.lastName,
                phone: ownerUser.phone || '',
              },
              {
                _id: offerMakerUser._id.toString(),
                AccountType: offerMakerUser.AccountType,
                firstName: offerMakerUser.firstName,
                lastName: offerMakerUser.lastName,
                phone: offerMakerUser.phone || '',
              }
            ];

            const chat = await this.chatService.create(chatUsers, new Date().toISOString());
            chatId = chat._id.toString();
            console.log(`✅ Chat created between ${ownerUser.firstName} and ${offerMakerUser.firstName} (ID: ${chatId})`);
          }
        } catch (chatError) {
          console.error('❌ Error creating chat on offer acceptance:', chatError);
          // Failsafe: Continue without chat, just log error
        }
      }

      // Send notification to the offer maker
      const notificationTitle = status === 'ACCEPTED'
        ? 'Offre Acceptée'
        : 'Offre Refusée';

      const notificationMessage = status === 'ACCEPTED'
        ? `Votre offre de ${offer.price} DA a été acceptée!`
        : `Votre offre de ${offer.price} DA a été refusée.`;

      if (offer.user && offer.user._id) {
        try {
          console.log('Service: Creating notification for offer maker:', offer.user._id);
          console.log('Service: Notification service available:', !!this.notificationService);

          if (!this.notificationService) {
            console.error('Service: Notification service is not available');
            throw new Error('Notification service not available');
          }

          await this.notificationService.create(
            offer.user._id.toString(),
            status === 'ACCEPTED' ? NotificationType.OFFER_ACCEPTED : NotificationType.OFFER_DECLINED,
            notificationTitle,
            notificationMessage,
            {
              offer: updatedOffer,
              tenderId: offer.tenderId || offer.bid,
              chatId: chatId // Include chat ID if available
            }
          );
          console.log('Service: Notification created successfully');
        } catch (notificationError) {
          console.error('Service: Error creating notification:', notificationError);
          // Don't fail the entire operation if notification fails
        }
      } else {
        console.warn('Service: No user found for offer, skipping notification');
      }

      console.log('Service: Offer status updated successfully:', updatedOffer._id);
      return updatedOffer;

    } catch (error) {
      console.error('Service: Error updating offer status:', error);
      throw error;
    }
  }

  /**
   * Accept an offer
   */
  async acceptOffer(offerId: string, ownerId: string): Promise<Offer> {
    return this.updateOfferStatus(offerId, 'ACCEPTED', ownerId);
  }

  /**
   * Reject an offer
   */
  async rejectOffer(offerId: string, ownerId: string): Promise<Offer> {
    return this.updateOfferStatus(offerId, 'DECLINED', ownerId);
  }

  /**
   * Delete an offer
   */
  async deleteOffer(offerId: string, userId: string): Promise<{ message: string }> {
    console.log('Service: Deleting offer:', { offerId, userId });

    try {
      // Validate ObjectId format
      if (!offerId || offerId.length !== 24) {
        console.error('Service: Invalid offer ID format:', offerId);
        throw new BadRequestException('Invalid offer ID format');
      }

      // Find the offer
      const offer = await this.offerModel.findById(offerId).populate('user', 'firstName lastName email').exec();
      if (!offer) {
        console.error('Service: Offer not found:', offerId);
        throw new BadRequestException(`Offer with ID ${offerId} not found`);
      }

      console.log('Service: Found offer:', {
        _id: offer._id,
        user: offer.user?._id,
        owner: offer.owner,
        currentStatus: offer.status,
        price: offer.price
      });

      // Authorization: allow deleting when
      // - requester is the offer creator (offer.user)
      // - OR requester is the tender/auction owner related to this offer
      let isAuthorized = false;
      const isOfferOwner = !!offer.user && offer.user._id?.toString() === userId;

      // Try to detect tender/auction owner via populated relations if available
      // depending on the schema, offer may relate to bid or tender
      const relatedBidOwnerId = (offer as any)?.bid?.owner?._id || (offer as any)?.bid?.owner;
      const relatedTenderOwnerId = (offer as any)?.tenderOwner?._id || (offer as any)?.tenderOwner;
      const isAuctionOwner = !!relatedBidOwnerId && relatedBidOwnerId.toString() === userId;
      const isTenderOwner = !!relatedTenderOwnerId && relatedTenderOwnerId.toString() === userId;

      isAuthorized = isOfferOwner || isAuctionOwner || isTenderOwner;

      if (!isAuthorized) {
        console.error('Service: Unauthorized access attempt:', {
          offerUser: offer.user?._id,
          relatedBidOwnerId,
          relatedTenderOwnerId,
          requestingUser: userId,
        });
        throw new ForbiddenException('Unauthorized: You can only delete your own offers or offers on your own tender');
      }

      // Delete the offer
      await this.offerModel.findByIdAndDelete(offerId);

      console.log('Service: Offer deleted successfully:', offerId);
      return { message: 'Offer deleted successfully' };

    } catch (error) {
      console.error('Service: Error deleting offer:', error);
      throw error;
    }
  }
}