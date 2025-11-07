import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tender, TenderDocument, TENDER_STATUS, TENDER_TYPE } from './schema/tender.schema';
import { TenderBid, TenderBidDocument, TenderBidStatus } from './schema/tender-bid.schema';
import { CreateTenderDto } from './dto/create-tender.dto';
import { UpdateTenderDto } from './dto/update-tender.dto';
import { CreateTenderBidDto } from './dto/create-tender-bid.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';
import { I18nService } from 'nestjs-i18n';
import { ProService } from '../user/services/pro.service';
import { ClientService } from '../user/services/client.service';
import { AttachmentService } from '../attachment/attachment.service';
import { SocketGateway } from 'src/socket/socket.gateway';
import { ChatDocument } from '../chat/schema/chat.schema';
import { UserService } from '../user/user.service';
import { Chat } from '../chat/schema/chat.schema';
import { User } from '../user/schema/user.schema';

@Injectable()
export class TenderService {
  constructor(
    @InjectModel(Tender.name) private tenderModel: Model<TenderDocument>,
    @InjectModel(TenderBid.name) private tenderBidModel: Model<TenderBidDocument>,
    private notificationService: NotificationService,
    private i18nService: I18nService,
    private proService: ProService,
    private clientService: ClientService,
    private attachmentService: AttachmentService,
    private readonly chatGateway: SocketGateway,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    private userService: UserService,
  ) {}

  // Add the missing findAllSellers method
  private async findAllSellers(): Promise<User[]> {
    return this.userModel
      .find({ role: 'SELLER' }) // Adjust the role value as needed for your application
      .populate('avatar')
      .exec();
  }

  async findOne(id: string): Promise<Tender> {
    try {
      // Validate ObjectId format
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        throw new NotFoundException(`Invalid tender ID format: "${id}"`);
      }

      const tender = await this.tenderModel
        .findById(id)
        .populate('attachments')
        .populate({
          path: 'owner',
          populate: {
            path: 'avatar',
            model: 'Attachment'
          }
        })
        .populate({
          path: 'category',
          populate: {
            path: 'thumb',
            model: 'Attachment'
          }
        })
        .populate('subCategory')
        .populate({ path: 'comments', populate: { path: 'user' } })
        .exec();
        
      if (!tender) {
        throw new NotFoundException(`Tender with ID "${id}" not found`);
      }
      
      return tender;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error in tenderService.findOne:', error);
      throw new NotFoundException(`Error retrieving tender with ID "${id}"`);
    }
  }

  async findAll(): Promise<TenderDocument[]> {
    return this.tenderModel.find()
      .populate({
        path: 'owner',
        populate: {
          path: 'avatar',
          model: 'Attachment'
        }
      })
      .populate('attachments')
      .populate({
        path: 'category',
        populate: {
          path: 'thumb',
          model: 'Attachment'
        }
      })
      .populate('subCategory')
      .exec();
  }

  async create(createTenderDto: CreateTenderDto): Promise<Tender> {
    console.log('🔍 [TenderService] Creating tender with DTO:', {
      title: createTenderDto.title,
      tenderType: createTenderDto.tenderType,
      auctionType: createTenderDto.auctionType,
      evaluationType: createTenderDto.evaluationType,
      hasEvaluationType: !!createTenderDto.evaluationType,
      allKeys: Object.keys(createTenderDto)
    });
    
    const createdTender = new this.tenderModel(createTenderDto);
    
    console.log('🔍 [TenderService] Tender model before save:', {
      title: createdTender.title,
      evaluationType: createdTender.evaluationType,
      evaluationTypeValue: (createdTender as any).evaluationType
    });
    
    const savedTender = await createdTender.save();
    
    console.log('✅ [TenderService] Tender saved with evaluationType:', savedTender.evaluationType);
    const populatedTender = await this.tenderModel
      .findById(savedTender._id)
      .populate('category')
      .populate('subCategory')
      .populate('attachments')
      .exec();

    // Get all sellers (professionals) to send notifications
    const sellers = await this.findAllSellers(); // Use the local method

    // Send notification to sellers about new tender
    const notificationTitle = 'Nouvel Appel d\'Offres Disponible';
    const categoryName = populatedTender.category?.name || 'Inconnue';
    if (!populatedTender.category) {
      console.warn(
        'Tender created without a valid category:',
        populatedTender,
      );
    }
    const notificationMessage = `Un nouvel appel d'offres dans la catégorie ${categoryName} est maintenant disponible. Soumettez votre offre dès maintenant !`;

    // Create notification for new tender for each seller
    for (const seller of sellers) {
      await this.notificationService.create(
        seller._id.toString(),
        NotificationType.BID_CREATED,
        notificationTitle,
        notificationMessage,
        populatedTender,
      );
    }

    return populatedTender;
  }

  async update(id: string, updateTenderDto: UpdateTenderDto): Promise<Tender> {
    const updatedTender = await this.tenderModel
      .findByIdAndUpdate(id, updateTenderDto, { new: true })
      .exec();

    if (!updatedTender) {
      const translatedMessage = await this.i18nService.t('TENDER.NOT_FOUND', {
        args: { id },
      });
      throw new NotFoundException(translatedMessage);
    }

    return updatedTender;
  }

  async checkTenders(id: string): Promise<void> {
    console.log('Checking tenders for user:', id);
    const getUser = await this.userService.getUserById(id);
    const getAllTenders = await this.tenderModel.find({ owner: id, status: TENDER_STATUS.OPEN }).exec();
    
    for (let index = 0; index < getAllTenders.length; index++) {
      const now = Date.now();
      const endDate = new Date(getAllTenders[index].endingAt).getTime();
      

      if (endDate < now) {
        const getTenderBids = await this.tenderBidModel.find({ tender: getAllTenders[index]._id });

        // For tenders, we want the LOWEST bid (reverse auction)
        if (getTenderBids.length > 0) {
          // Find the lowest bid
          let lowestBid = getTenderBids[0];
          
          for (let i = 1; i < getTenderBids.length; i++) {
            if (getTenderBids[i].bidAmount < lowestBid.bidAmount) {
              lowestBid = getTenderBids[i];
            }
          }

          // Check if tender owner is a professional user for automatic awarding
          const tenderOwner = await this.userModel.findById(getAllTenders[index].owner).exec();
          const isProfessionalOwner = tenderOwner && tenderOwner.type === 'PROFESSIONAL';

          if (isProfessionalOwner) {
            // Award the tender to the lowest bidder automatically for professional users
            await this.tenderModel.findByIdAndUpdate(getAllTenders[index]._id, {
              status: TENDER_STATUS.AWARDED,
              awardedTo: lowestBid.bidder,
            });
          } else {
            // For non-professional users, just close the tender without automatic awarding
            await this.tenderModel.findByIdAndUpdate(getAllTenders[index]._id, {
              status: TENDER_STATUS.CLOSED,
            });
            continue;
          }

            const getWinner = await this.userModel.findOne({_id: lowestBid.bidder});

            let users = [getUser, getWinner];
            let createdAt = new Date();

            const chat = new this.chatModel({users , createdAt})
            await chat.save()

            // Send socket notification for new chat to winner (seller)
            this.chatGateway.sendNewChatToBuyer(
              lowestBid.bidder._id.toString(),
              {
                type: 'TENDER_WON',
                title: 'Félicitations! Vous avez remporté l\'appel d\'offres',
                message: `Vous avez remporté l'appel d'offres pour "${getAllTenders[index].title || 'le projet'}" avec votre offre de ${lowestBid.bidAmount}€. Un chat a été créé avec l'acheteur pour finaliser la transaction.`,
                chatId: chat._id,
                buyerName: getUser.firstName + ' ' + getUser.lastName,
                tenderTitle: getAllTenders[index].title
              }
            );

            // Send socket notification for new chat to tender owner (buyer)
            this.chatGateway.sendNewChatToSeller(
              getUser._id.toString(),
              {
                type: 'TENDER_AWARDED',
                title: 'Votre appel d\'offres a été attribué',
                message: `Votre appel d'offres "${getAllTenders[index].title || 'le projet'}" a été attribué à ${getWinner.firstName} ${getWinner.lastName} pour ${lowestBid.bidAmount}€. Un chat a été créé pour finaliser la transaction.`,
                chatId: chat._id,
                winnerName: getWinner.firstName + ' ' + getWinner.lastName,
                tenderTitle: getAllTenders[index].title
              }
            );

            // Send winner notification (DB) to seller
            await this.notificationService.create(
              lowestBid.bidder._id.toString(),
              NotificationType.BID_WON,
              'Félicitations! Vous avez remporté l\'appel d\'offres',
              `Vous avez remporté l'appel d'offres pour "${getAllTenders[index].title || 'le projet'}". Un chat a été créé avec l'acheteur pour finaliser la transaction.`,
              {
                tenderId: getAllTenders[index]._id,
                tenderTitle: getAllTenders[index].title,
                buyerId: getUser._id,
                sellerId: lowestBid.bidder._id,
                finalPrice: lowestBid.bidAmount
              }
            );

            // Send buyer notification for tender award (DB)
            await this.notificationService.create(
              getUser._id.toString(),
              NotificationType.ITEM_SOLD,
              'Votre appel d\'offres a été attribué',
              `Votre appel d'offres "${getAllTenders[index].title || 'le projet'}" a été attribué à ${getWinner.firstName} ${getWinner.lastName} pour ${lowestBid.bidAmount}€. Un chat a été créé pour finaliser la transaction.`,
              {
                tenderId: getAllTenders[index]._id,
                tenderTitle: getAllTenders[index].title,
                sellerId: lowestBid.bidder._id,
                sellerName: getWinner.firstName + ' ' + getWinner.lastName,
                finalPrice: lowestBid.bidAmount,
                chatId: chat._id
              }
            );

            // Add CHAT_CREATED notification for seller
            await this.notificationService.create(
              lowestBid.bidder._id.toString(),
              NotificationType.CHAT_CREATED,
              'Nouveau chat créé',
              `Un nouveau chat a été créé avec l'acheteur ${getUser.firstName} ${getUser.lastName} pour finaliser votre projet "${getAllTenders[index].title || 'le projet'}".`,
              {
                chatId: chat._id,
                buyerName: getUser.firstName + ' ' + getUser.lastName,
                tenderTitle: getAllTenders[index].title
              }
            );

            // Add CHAT_CREATED notification for buyer
            await this.notificationService.create(
              getUser._id.toString(),
              NotificationType.CHAT_CREATED,
              'Nouveau chat avec le gagnant',
              `Un nouveau chat a été créé avec le prestataire ${getWinner.firstName} ${getWinner.lastName} pour finaliser votre projet "${getAllTenders[index].title || 'le projet'}".`,
              {
                chatId: chat._id,
                winnerName: getWinner.firstName + ' ' + getWinner.lastName,
                tenderTitle: getAllTenders[index].title
              }
            );

            this.chatGateway.sendNotificationChatCreateToOne(lowestBid.bidder._id.toString());

            // Send notifications to all participants about the tender result
            await this.notifyAllParticipants(getAllTenders[index]._id, lowestBid, getAllTenders[index].title);

            continue;
        }

        // If no acceptable bids, close the tender
        await this.tenderModel.findByIdAndUpdate(getAllTenders[index]._id, {
          status: TENDER_STATUS.CLOSED,
        });
      }
    }
    return;
  }

  async remove(id: string): Promise<Tender> {
    const deletedTender = await this.tenderModel.findByIdAndDelete(id).exec();

    if (!deletedTender) {
      const translatedMessage = await this.i18nService.t('TENDER.NOT_FOUND', {
        args: { id },
      });
      throw new NotFoundException(translatedMessage);
    }

    return deletedTender;
  }

  async findByOwner(ownerId: string): Promise<Tender[]> {
    return this.tenderModel.find({ owner: ownerId }).populate('attachments').exec();
  }

  // Tender bid methods
  async createTenderBid(tenderId: string, createTenderBidDto: CreateTenderBidDto, isMieuxDisant: boolean = false): Promise<TenderBid> {
    
    console.log('🔍 [TenderService] Creating bid:', {
      tenderId,
      isMieuxDisant,
      bidAmount: createTenderBidDto.bidAmount,
      hasProposal: !!createTenderBidDto.proposal
    });
    
    // Validate based on evaluation type
    if (isMieuxDisant) {
      // For MIEUX_DISANT: Proposal is required
      if (!createTenderBidDto.proposal || createTenderBidDto.proposal.trim().length < 10) {
        throw new BadRequestException('Une proposition détaillée est requise (minimum 10 caractères)');
      }
    } else {
      // For MOINS_DISANT: Bid amount must be positive
      if (!createTenderBidDto.bidAmount || createTenderBidDto.bidAmount <= 0) {
        throw new BadRequestException('Le montant de l\'offre doit être un nombre positif');
      }
    }
    
    if (!createTenderBidDto.bidder) {
      throw new BadRequestException('Bidder ID is required');
    }
    
    if (!createTenderBidDto.tenderOwner) {
      throw new BadRequestException('Tender owner ID is required');
    }
    
    const tender = await this.findOne(tenderId);
    console.log("Found tender:", tender._id);

    // Check if tender is still active
    if (tender.status !== 'OPEN') {
      throw new BadRequestException('Tender is no longer accepting bids');
    }
    
    // Check if tender has ended
    if (new Date() > new Date(tender.endingAt)) {
      throw new BadRequestException('Tender has ended');
    }

    // For MOINS_DISANT: Validate that new bid is less than the current lowest bid
    if (!isMieuxDisant) {
      const existingBids = await this.tenderBidModel.find({ tender: tenderId }).exec();
      
      if (existingBids.length > 0) {
        // Find the lowest bid amount
        const lowestBidAmount = Math.min(...existingBids.map(bid => bid.bidAmount));
        
        // Check if new bid is less than the lowest bid
        if (createTenderBidDto.bidAmount >= lowestBidAmount) {
          throw new BadRequestException(
            `Votre offre doit être inférieure à la dernière offre actuelle de ${lowestBidAmount} DA. Vous ne pouvez pas faire une offre supérieure ou égale à la dernière offre.`
          );
        }
      }
    }

    // Create the tender bid
    const createdTenderBid = new this.tenderBidModel({ 
      ...createTenderBidDto, 
      tender: tenderId,
    });
    const savedTenderBid = await createdTenderBid.save();
    console.log("Tender bid created:", savedTenderBid._id);

    // Create notification for tender owner
    const tenderOwnerTitle = "Nouvelle offre reçue";
    const tenderOwnerMessage = `Une nouvelle offre de ${createTenderBidDto.bidAmount}€ a été soumise pour votre appel d'offres "${tender.title}"`;

    // Check if tender.owner exists and has _id before trying to access it
    if (tender.owner && tender.owner._id) {
      console.log("Creating notification for tender owner:", tender.owner._id.toString());
      await this.notificationService.create(
        tender.owner._id.toString(),
        NotificationType.NEW_OFFER,
        tenderOwnerTitle,
        tenderOwnerMessage,
        { tender: tender, tenderBid: savedTenderBid }
      );
    } else {
      console.log("Warning: Tender owner is null or missing _id, skipping notification");
    }

    return savedTenderBid;
  }

  async getTenderBidsByTenderId(tenderId: string): Promise<TenderBid[]> {
    return this.tenderBidModel
      .find({ tender: tenderId })
      .populate('bidder', 'firstName lastName phone email username')
      .populate('tender', 'title category')
      .lean()
      .exec();
  }

  async getTenderBidsByOwnerId(ownerId: string): Promise<TenderBid[]> {
    // Find all tenders created by the owner
    const tenders = await this.findByOwner(ownerId);
    const tenderIds = tenders.map(tender => tender._id);

    // Find all bids associated with these tender IDs
    return this.tenderBidModel
      .find({ tender: { $in: tenderIds } })
      .populate('bidder', 'firstName lastName phone email username')
      .populate('tender', 'title category')
      .lean()
      .exec();
  }

  async getTenderBidsByBidderId(bidderId: string): Promise<TenderBid[]> {
    return this.tenderBidModel
      .find({ bidder: bidderId })
      .populate('bidder', 'firstName lastName phone email username')
      .populate('tender', 'title category')
      .lean()
      .exec();
  }

  /**
   * Accept a tender bid
   */
  async acceptTenderBid(bidId: string, ownerId: string): Promise<TenderBid> {
    console.log('TenderService: Accepting tender bid:', { bidId, ownerId });
    
    try {
      // Find the tender bid
      const tenderBid = await this.tenderBidModel.findById(bidId).populate('tender').exec();
      if (!tenderBid) {
        throw new BadRequestException(`Tender bid with ID ${bidId} not found`);
      }

      // Verify the owner has permission to accept this bid
      const tender = await this.tenderModel.findById(tenderBid.tender._id).exec();
      if (!tender || tender.owner.toString() !== ownerId) {
        throw new ForbiddenException('You can only accept bids for your own tenders');
      }

      // Update the tender bid status
      tenderBid.status = TenderBidStatus.ACCEPTED;
      const updatedBid = await tenderBid.save();

      // Send notification to the bidder
      try {
        const notificationTitle = "Offre Acceptée";
        const notificationMessage = `Votre offre de ${tenderBid.bidAmount} DA pour l'appel d'offres "${tender.title}" a été acceptée!`;
        
        // Extract the bidder ID properly from the populated object
        const bidderId = tenderBid.bidder._id ? tenderBid.bidder._id.toString() : tenderBid.bidder.toString();
        
        console.log('🔔 TenderService: Creating notification for bidder:', {
          bidderId: tenderBid.bidder,
          bidderIdString: bidderId,
          bidderIdType: typeof tenderBid.bidder,
          tenderTitle: tender.title,
          notificationTitle,
          notificationMessage
        });
        
        await this.notificationService.create(
          bidderId,
          NotificationType.OFFER_ACCEPTED,
          notificationTitle,
          notificationMessage,
          { 
            tenderBid: updatedBid, 
            tender: tender,
            bidAmount: tenderBid.bidAmount,
            tenderTitle: tender.title
          },
          ownerId, // senderId (tender owner)
          undefined, // senderName (will be populated by notification service)
          undefined  // senderEmail (will be populated by notification service)
        );
        
        console.log('TenderService: Notification sent to bidder:', tenderBid.bidder);
      } catch (notificationError) {
        console.error('TenderService: Error sending notification:', notificationError);
        // Don't fail the entire operation if notification fails
      }

      console.log('TenderService: Tender bid accepted successfully:', updatedBid._id);
      return updatedBid;
    } catch (error) {
      console.error('TenderService: Error accepting tender bid:', error);
      throw error;
    }
  }

  /**
   * Reject a tender bid
   */
  async rejectTenderBid(bidId: string, ownerId: string): Promise<TenderBid> {
    console.log('TenderService: Rejecting tender bid:', { bidId, ownerId });
    
    try {
      // Find the tender bid
      const tenderBid = await this.tenderBidModel.findById(bidId).populate('tender').exec();
      if (!tenderBid) {
        throw new BadRequestException(`Tender bid with ID ${bidId} not found`);
      }

      // Verify the owner has permission to reject this bid
      const tender = await this.tenderModel.findById(tenderBid.tender._id).exec();
      if (!tender || tender.owner.toString() !== ownerId) {
        throw new ForbiddenException('You can only reject bids for your own tenders');
      }

      // Update the tender bid status
      tenderBid.status = TenderBidStatus.DECLINED;
      const updatedBid = await tenderBid.save();

      // Send notification to the bidder
      try {
        const notificationTitle = "Offre Refusée";
        const notificationMessage = `Votre offre de ${tenderBid.bidAmount} DA pour l'appel d'offres "${tender.title}" a été refusée.`;
        
        // Extract the bidder ID properly from the populated object
        const bidderId = tenderBid.bidder._id ? tenderBid.bidder._id.toString() : tenderBid.bidder.toString();
        
        await this.notificationService.create(
          bidderId,
          NotificationType.OFFER_DECLINED,
          notificationTitle,
          notificationMessage,
          { 
            tenderBid: updatedBid, 
            tender: tender,
            bidAmount: tenderBid.bidAmount,
            tenderTitle: tender.title
          },
          ownerId, // senderId (tender owner)
          undefined, // senderName (will be populated by notification service)
          undefined  // senderEmail (will be populated by notification service)
        );
        
        console.log('TenderService: Notification sent to bidder:', tenderBid.bidder);
      } catch (notificationError) {
        console.error('TenderService: Error sending notification:', notificationError);
        // Don't fail the entire operation if notification fails
      }

      console.log('TenderService: Tender bid rejected successfully:', updatedBid._id);
      return updatedBid;
    } catch (error) {
      console.error('TenderService: Error rejecting tender bid:', error);
      throw error;
    }
  }

  /**
   * Delete a tender bid
   */
  async deleteTenderBid(bidId: string, userId: string): Promise<TenderBid> {
    console.log('TenderService: Deleting tender bid:', { bidId, userId });
    
    try {
      // Find the tender bid
      const tenderBid = await this.tenderBidModel.findById(bidId).populate('tender').exec();
      if (!tenderBid) {
        throw new BadRequestException(`Tender bid with ID ${bidId} not found`);
      }

      // Verify the user has permission to delete this bid (either the bidder or tender owner)
      const tender = await this.tenderModel.findById(tenderBid.tender._id).exec();
      const isBidder = tenderBid.bidder.toString() === userId;
      const isTenderOwner = tender && tender.owner.toString() === userId;
      
      if (!isBidder && !isTenderOwner) {
        throw new ForbiddenException('You can only delete your own bids or bids on your own tenders');
      }

      // Delete the tender bid
      const deletedBid = await this.tenderBidModel.findByIdAndDelete(bidId).exec();
      if (!deletedBid) {
        throw new BadRequestException(`Tender bid with ID ${bidId} not found`);
      }

      console.log('TenderService: Tender bid deleted successfully:', deletedBid._id);
      return deletedBid;
    } catch (error) {
      console.error('TenderService: Error deleting tender bid:', error);
      throw error;
    }
  }

  /**
   * Delete a tender
   */
  async deleteTender(tenderId: string, userId: string): Promise<Tender> {
    console.log('TenderService: Deleting tender:', { tenderId, userId });

    try {
      // Find the tender
      const tender = await this.tenderModel.findById(tenderId).exec();
      if (!tender) {
        throw new BadRequestException(`Tender with ID ${tenderId} not found`);
      }

      // Verify the user has permission to delete this tender (only the owner)
      if (tender.owner.toString() !== userId) {
        throw new ForbiddenException('You can only delete your own tenders');
      }

      // Delete all associated tender bids first
      await this.tenderBidModel.deleteMany({ tender: tenderId }).exec();

      // Delete the tender
      const deletedTender = await this.tenderModel.findByIdAndDelete(tenderId).exec();
      if (!deletedTender) {
        throw new BadRequestException(`Tender with ID ${tenderId} not found`);
      }

      console.log('TenderService: Tender deleted successfully:', deletedTender._id);
      return deletedTender;
    } catch (error) {
      console.error('TenderService: Error deleting tender:', error);
      throw error;
    }
  }

  /**
   * Check all open tenders and automatically award them if they have ended
   * This method should be called periodically (e.g., via cron job)
   */
  async checkAllTendersForAutoAward(): Promise<void> {
    console.log('Checking all tenders for automatic awarding...');
    
    try {
      // Get all open tenders
      const openTenders = await this.tenderModel.find({ status: TENDER_STATUS.OPEN }).exec();
      console.log(`Found ${openTenders.length} open tenders to check`);

      for (const tender of openTenders) {
        const now = Date.now();
        const endDate = new Date(tender.endingAt).getTime();

        if (endDate < now) {
          console.log(`Tender ${tender._id} has ended, checking for automatic awarding...`);
          
          // Get all bids for this tender
          const tenderBids = await this.tenderBidModel.find({ tender: tender._id }).exec();

          if (tenderBids.length > 0) {
            // Find the lowest bid
            let lowestBid = tenderBids[0];
            for (let i = 1; i < tenderBids.length; i++) {
              if (tenderBids[i].bidAmount < lowestBid.bidAmount) {
                lowestBid = tenderBids[i];
              }
            }

            // Check if tender owner is a professional user
            const tenderOwner = await this.userModel.findById(tender.owner).exec();
            const isProfessionalOwner = tenderOwner && tenderOwner.type === 'PROFESSIONAL';

            if (isProfessionalOwner) {
              console.log(`Auto-awarding tender ${tender._id} to lowest bidder ${lowestBid.bidder}`);
              
              // Award the tender to the lowest bidder
              await this.tenderModel.findByIdAndUpdate(tender._id, {
                status: TENDER_STATUS.AWARDED,
                awardedTo: lowestBid.bidder,
              });

              // Get winner details
              const getWinner = await this.userModel.findById(lowestBid.bidder).exec();
              const getTenderOwner = await this.userModel.findById(tender.owner).exec();

              // Create chat between winner and tender owner
              const users = [getTenderOwner, getWinner];
              const createdAt = new Date();
              const chat = new this.chatModel({ users, createdAt });
              await chat.save();

              // Send notifications to all participants
              await this.notifyAllParticipants(tender._id, lowestBid, tender.title);

              console.log(`Tender ${tender._id} automatically awarded successfully`);
            } else {
              // For non-professional users, just close the tender
              await this.tenderModel.findByIdAndUpdate(tender._id, {
                status: TENDER_STATUS.CLOSED,
              });
              console.log(`Tender ${tender._id} closed (non-professional owner)`);
            }
          } else {
            // No bids, close the tender
            await this.tenderModel.findByIdAndUpdate(tender._id, {
              status: TENDER_STATUS.CLOSED,
            });
            console.log(`Tender ${tender._id} closed (no bids)`);
          }
        }
      }

      console.log('All tenders checked for automatic awarding');
    } catch (error) {
      console.error('Error checking tenders for auto-award:', error);
    }
  }

  /**
   * Notify all participants about tender results
   */
  private async notifyAllParticipants(tenderId: string, winningBid: any, tenderTitle: string): Promise<void> {
    try {
      // Get all bids for this tender
      const allBids = await this.tenderBidModel
        .find({ tender: tenderId })
        .populate('bidder', 'firstName lastName email')
        .exec();

      console.log(`Notifying ${allBids.length} participants about tender results`);

      // Send notifications to all participants
      for (const bid of allBids) {
        const isWinner = bid._id.toString() === winningBid._id.toString();
        
        if (isWinner) {
          // Winner notification
          await this.notificationService.create(
            bid.bidder._id.toString(),
            NotificationType.BID_WON,
            '🎉 Félicitations! Vous avez remporté l\'appel d\'offres',
            `Vous avez remporté l'appel d'offres "${tenderTitle}" avec votre offre de ${bid.bidAmount} DA. L'acheteur vous contactera bientôt pour finaliser la transaction.`,
            {
              tenderId: tenderId,
              tenderTitle: tenderTitle,
              bidAmount: bid.bidAmount,
              isWinner: true
            }
          );
        } else {
          // Loser notification
          await this.notificationService.create(
            bid.bidder._id.toString(),
            NotificationType.OFFER_DECLINED,
            'Appel d\'offres attribué à un autre participant',
            `L'appel d'offres "${tenderTitle}" a été attribué à un autre participant avec une offre de ${winningBid.bidAmount} DA. Merci pour votre participation!`,
            {
              tenderId: tenderId,
              tenderTitle: tenderTitle,
              winningBidAmount: winningBid.bidAmount,
              yourBidAmount: bid.bidAmount,
              isWinner: false
            }
          );
        }
      }

      console.log('All participant notifications sent successfully');
    } catch (error) {
      console.error('Error notifying participants:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }
}