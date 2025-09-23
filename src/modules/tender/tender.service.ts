import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tender, TenderDocument, TENDER_STATUS, TENDER_TYPE } from './schema/tender.schema';
import { TenderBid, TenderBidDocument } from './schema/tender-bid.schema';
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
        .populate('category')
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
      .populate('category') 
      .populate('subCategory')
      .exec();
  }

  async create(createTenderDto: CreateTenderDto): Promise<Tender> {
    // Initialize currentLowestBid to maxBudget for reverse auction
    createTenderDto.currentLowestBid = createTenderDto.maxBudget;

    console.log('Creating tender:', createTenderDto);

    const createdTender = new this.tenderModel(createTenderDto);
    const savedTender = await createdTender.save();
    const populatedTender = await this.tenderModel
      .findById(savedTender._id)
      .populate('category')
      .populate('subCategory')
      .populate('attachments')
      .exec();
    
    console.log('Tender created:', populatedTender);

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
      
      console.log("endDate", endDate);
      console.log("now", now);

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

          // Check if the lowest bid meets the minimum price requirement
          const meetsPriceRequirement = !getAllTenders[index].minimumPrice || 
                                        lowestBid.bidAmount >= getAllTenders[index].minimumPrice;

          if (meetsPriceRequirement) {
            // Award the tender to the lowest bidder
            await this.tenderModel.findByIdAndUpdate(getAllTenders[index]._id, {
              status: TENDER_STATUS.AWARDED,
              awardedTo: lowestBid.bidder,
            });

            const getWinner = await this.userModel.findOne({_id: lowestBid.bidder});
            console.log("Winner of tender:", getWinner);

            let users = [getUser, getWinner];
            let createdAt = new Date();

            const chat = new this.chatModel({users , createdAt})
            await chat.save()
            console.log('Chat created for tender:', chat);

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

            console.log("Tender awarded to:", getWinner);
            continue;
          }
        }

        // If no acceptable bids, close the tender
        await this.tenderModel.findByIdAndUpdate(getAllTenders[index]._id, {
          status: TENDER_STATUS.CLOSED,
        });

        console.log("Tender closed (no acceptable bids):", getAllTenders[index]._id);
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
  async createTenderBid(tenderId: string, createTenderBidDto: CreateTenderBidDto): Promise<TenderBid> {
    console.log("Creating new tender bid");
    const tender = await this.findOne(tenderId);
    console.log("Found tender:", tender._id);

    // Check if the bid amount is lower than current lowest bid (reverse auction logic)
    if (createTenderBidDto.bidAmount >= tender.currentLowestBid) {
      const translatedMessage = await this.i18nService.t('TENDER_BID.INVALID_PRICE');
      throw new BadRequestException('Bid amount must be lower than current lowest bid');
    }

    // Check if bid meets minimum price requirement
    if (tender.minimumPrice && createTenderBidDto.bidAmount < tender.minimumPrice) {
      throw new BadRequestException('Bid amount is below minimum acceptable price');
    }

    // Create the tender bid
    const createdTenderBid = new this.tenderBidModel({ 
      ...createTenderBidDto, 
      tender: tenderId,
    });
    const savedTenderBid = await createdTenderBid.save();
    console.log("Tender bid created:", savedTenderBid._id);

    // Update the tender's current lowest bid
    const updatedTender = await this.update(tender._id, { currentLowestBid: createTenderBidDto.bidAmount });
    console.log("Tender current lowest bid updated");

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
        { tender: updatedTender, tenderBid: savedTenderBid }
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
      .populate('tender', 'title currentLowestBid category')
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
      .populate('tender', 'title currentLowestBid category')
      .lean()
      .exec();
  }

  async getTenderBidsByBidderId(bidderId: string): Promise<TenderBid[]> {
    return this.tenderBidModel
      .find({ bidder: bidderId })
      .populate('bidder', 'firstName lastName phone email username')
      .populate('tender', 'title currentLowestBid category')
      .lean()
      .exec();
  }
}