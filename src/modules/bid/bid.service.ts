import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Schema as MongooseSchema } from 'mongoose';
import { Bid, BidDocument, AUCTION_TYPE, BID_STATUS, BID_TYPE } from './schema/bid.schema';
import { CreateBidDto } from './dto/create-bid.dto';
import { UpdateBidDto } from './dto/update-bid.dto';
import { RelaunchBidDto } from './dto/relaunch-bid.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';
import { I18nService } from 'nestjs-i18n';
import { ProService } from '../user/services/pro.service';
import { ClientService } from '../user/services/client.service';
import { AttachmentService } from '../attachment/attachment.service';
import { OfferService } from './offer.service';
import { Offer, OfferDocument } from './schema/offer.schema';
import { SocketGateway } from 'src/socket/socket.gateway';
import { ChatDocument } from '../chat/schema/chat.schema';
import { UserService } from '../user/user.service';
import { Chat } from '../chat/schema/chat.schema';
import { User } from '../user/schema/user.schema';
import { SearchService } from '../search/search.service';


@Injectable()
export class BidService {
  constructor(
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>,
    @InjectModel(Offer.name) private OfferModel: Model<OfferDocument>,
    private notificationService: NotificationService,
    private i18nService: I18nService,
    private proService: ProService,
    private clientService: ClientService,
    private attachmentService: AttachmentService,
    @Inject(forwardRef(() => OfferService))
    private offerService: OfferService,
    private readonly ChatGateWay: SocketGateway,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    private userService: UserService,
    private searchService: SearchService,
  ) { }


  async findOne(id: string): Promise<Bid> {
    try {
      // Validate ObjectId format
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        throw new NotFoundException(`Invalid bid ID format: "${id}"`);
      }

      const bid = await this.bidModel
        .findById(id)
        .populate('thumbs')
        .populate('videos')
        .populate({
          path: 'owner',
          populate: {
            path: 'avatar',
            model: 'Attachment'
          }
        })
        .populate('productCategory')
        .populate('productSubCategory')
        .populate({
          path: 'comments',
          populate: [
            { path: 'user' },
            {
              path: 'replies',
              populate: [
                { path: 'user' },
                {
                  path: 'replies',
                  populate: { path: 'user' }
                }
              ]
            }
          ]
        })
        .exec();

      if (!bid) {
        throw new NotFoundException(`Bid with ID "${id}" not found`);
      }

      return bid;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error in bidService.findOne:', error);
      throw new NotFoundException(`Error retrieving bid with ID "${id}"`);
    }
  }

  async findAll(user?: any): Promise<BidDocument[]> {
    const query: any = {};

    // If not professional, only show items NOT marked as professionalOnly
    const isProfessional = user?.type === 'PROFESSIONAL';
    if (!isProfessional) {
      query.professionalOnly = { $ne: true };
    }

    return this.bidModel.find(query)
      .populate({
        path: 'owner',
        populate: {
          path: 'avatar',
          model: 'Attachment'
        }
      })
      .populate('thumbs')
      .populate('videos')
      .populate('productCategory')
      .populate('productSubCategory')
      .exec();
  }


  async create(createBidDto: CreateBidDto): Promise<Bid> {

    createBidDto.currentPrice = createBidDto.startingPrice;

    // Log bid creation details including thumbs
    // console.log('Creating bid:', createBidDto.title);
    // console.log('Bid DTO thumbs (type:', typeof createBidDto.thumbs, ', isArray:', Array.isArray(createBidDto.thumbs), '):', createBidDto.thumbs);
    // console.log('Bid DTO videos (type:', typeof createBidDto.videos, ', isArray:', Array.isArray(createBidDto.videos), '):', createBidDto.videos);
    // console.log('Bid DTO thumbs length:', createBidDto.thumbs?.length || 0);
    // console.log('Bid DTO videos length:', createBidDto.videos?.length || 0);

    // Ensure thumbs and videos are arrays
    if (!Array.isArray(createBidDto.thumbs)) {
      // console.warn('WARNING: thumbs is not an array, converting:', createBidDto.thumbs);
      createBidDto.thumbs = createBidDto.thumbs ? [createBidDto.thumbs] : [];
    }
    if (!Array.isArray(createBidDto.videos)) {
      // console.warn('WARNING: videos is not an array, converting:', createBidDto.videos);
      createBidDto.videos = createBidDto.videos ? [createBidDto.videos] : [];
    }

    // console.log('Bid DTO full object (thumbs/videos only):', {
    //   thumbs: createBidDto.thumbs,
    //   videos: createBidDto.videos,
    //   thumbsCount: createBidDto.thumbs.length,
    //   videosCount: createBidDto.videos.length
    // });

    const createdBid = new this.bidModel(createBidDto);
    // console.log('Bid model before save - thumbs (raw):', createdBid.thumbs);
    // console.log('Bid model before save - thumbs (type):', typeof createdBid.thumbs, Array.isArray(createdBid.thumbs));
    // console.log('Bid model before save - thumbs (length):', createdBid.thumbs?.length || 0);

    const savedBid = await createdBid.save();
    // console.log('Bid saved - thumbs (raw):', savedBid.thumbs);
    // console.log('Bid saved - thumbs (type):', typeof savedBid.thumbs, Array.isArray(savedBid.thumbs));
    // console.log('Bid saved - thumbs (length):', savedBid.thumbs?.length || 0);

    // Verify the saved bid has thumbs
    const verificationBid = await this.bidModel.findById(savedBid._id).select('thumbs videos').lean();
    // console.log('Verification query - thumbs:', verificationBid?.thumbs);
    // console.log('Verification query - thumbs length:', verificationBid?.thumbs?.length || 0);
    const populatedBid = await this.bidModel
      .findById(savedBid._id)
      .populate('productCategory')
      .populate('productSubCategory')
      .populate('thumbs')
      .exec();

    if (process.env.NODE_ENV === 'development') {
      // console.log('Bid created:', populatedBid._id);
    }

    // Remove broadcast notification to all buyers as per user request
    // Notifications should only be sent to the creator upon successful creation

    /*
    // Get all buyers (clients) to send notifications
    const buyers = await this.clientService.findAllSellers();

    // Use hardcoded French translations for notifications
    const notificationTitle = 'Nouvelle Enchère Disponible';
    const categoryName = populatedBid.productCategory?.name || 'Inconnue';
    if (!populatedBid.productCategory) {
      console.warn(
        'Bid created without a valid productCategory:',
        populatedBid,
      );
    }
    const notificationMessage = `Une nouvelle enchère dans la catégorie ${categoryName} est maintenant disponible. Participez dès maintenant !`;

    // Create notification for new bid for each buyer
    for (const buyer of buyers) {
      await this.notificationService.create(
        buyer._id.toString(),
        NotificationType.BID_CREATED,
        notificationTitle,
        notificationMessage,
        populatedBid,
        populatedBid.owner?._id?.toString(), // senderId
        `${populatedBid.owner?.firstName || 'Unknown'} ${populatedBid.owner?.lastName || 'User'}`, // senderName
        populatedBid.owner?.email // senderEmail
      );
    }
    */

    // Send confirmation notification to auction creator
    if (populatedBid.owner && populatedBid.owner._id) {
      await this.notificationService.create(
        populatedBid.owner._id.toString(),
        NotificationType.BID_CREATED,
        'Enchère créée avec succès',
        `Votre enchère "${populatedBid.title}" a été créée avec succès et est maintenant disponible pour les acheteurs.`,
        populatedBid,
        populatedBid.owner._id.toString(),
        `${populatedBid.owner?.firstName || 'Unknown'} ${populatedBid.owner?.lastName || 'User'}`,
        populatedBid.owner?.email
      );
    }

    // Check if any users were looking for this item
    console.log('📢 Checking for interested users for auction:', populatedBid.title);
    this.searchService.notifyInterestedUsers(
      populatedBid.title,
      populatedBid.description || '',
      'auction',
      populatedBid._id.toString()
    ).catch(err => console.error('Error notifying interested users:', err));

    return populatedBid;
  }

  async update(id: string, updateBidDto: UpdateBidDto): Promise<Bid> {
    const updatedBid = await this.bidModel
      .findByIdAndUpdate(id, updateBidDto, { new: true })
      .exec();

    if (!updatedBid) {
      const translatedMessage = await this.i18nService.t('BID.NOT_FOUND', {
        args: { id },
      });
      throw new NotFoundException(translatedMessage);
    }

    return updatedBid;
  }

  async incrementParticipantsCount(bidId: string): Promise<void> {
    await this.bidModel.findByIdAndUpdate(bidId, { $inc: { participantsCount: 1 } });
  }


  async checkBids(id: string): Promise<void> {
    // Validate ObjectId before querying
    if (!id || typeof id !== 'string' || id.trim() === '' || !/^[0-9a-fA-F]{24}$/.test(id)) {
      console.warn('checkBids: Invalid user ID provided:', id);
      return;
    }

    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      // console.log('Checking bids for user:', id);
    }

    const getUser = await this.userService.getUserById(id);
    if (!getUser) {
      console.warn('checkBids: User not found for ID:', id);
      return;
    }

    const getAllBids = await this.bidModel.find({ owner: id, status: BID_STATUS.OPEN }).exec();
    for (let index = 0; index < getAllBids.length; index++) {
      const now = Date.now();
      const data = new Date(getAllBids[index].endingAt).getTime();

      if (data < now) {

        const getOffers = await this.OfferModel.find({ bid: getAllBids[index]._id });

        if (getAllBids[index].bidType == BID_TYPE.PRODUCT) {


          if (
            getOffers.length != 0 &&
            getAllBids[index].currentPrice >= getAllBids[index].reservePrice
          ) {
            let max = getOffers[0];

            for (let i = 0; i < getOffers.length; i++) {
              if (getOffers[i].price > max.price) {
                max = getOffers[i];
              }
            }

            await this.bidModel.findByIdAndUpdate(getAllBids[index]._id, {
              status: BID_STATUS.ON_AUCTION,
              winner: max.user,
              // isSell: true,
            });

            const getAther = await this.userModel.findOne({ _id: max.user });

            let users = [getUser, getAther];
            let createdAt = new Date();

            const chat = new this.chatModel({ users, createdAt })
            await chat.save()

            // Send socket notification for new chat to buyer
            this.ChatGateWay.sendNewChatToBuyer(
              max.user._id.toString(),
              {
                type: 'NEW_CHAT',
                title: 'Nouveau chat créé',
                message: `Un nouveau chat a été créé avec le vendeur ${getUser.firstName} ${getUser.lastName} pour finaliser votre achat de "${getAllBids[index].title || 'le produit'}".`,
                chatId: chat._id,
                sellerName: getUser.firstName + ' ' + getUser.lastName,
                productTitle: getAllBids[index].title
              }
            );

            // Send socket notification for new chat to seller
            this.ChatGateWay.sendNewChatToSeller(
              getUser._id.toString(),
              {
                type: 'NEW_CHAT',
                title: 'Nouveau chat avec le gagnant',
                message: `Un nouveau chat a été créé avec l'acheteur ${getAther.firstName} ${getAther.lastName} pour finaliser la vente de "${getAllBids[index].title || 'le produit'}".`,
                chatId: chat._id,
                winnerName: getAther.firstName + ' ' + getAther.lastName,
                productTitle: getAllBids[index].title
              }
            );

            // Send winner notification (DB)
            await this.notificationService.create(
              max.user._id.toString(),
              NotificationType.BID_WON,
              'Félicitations! Vous avez remporté l\'enchère',
              `Vous avez remporté l'enchère pour "${getAllBids[index].title || 'le produit'}". Un chat a été créé avec le vendeur pour finaliser la transaction.`,
              {
                bidId: getAllBids[index]._id,
                productTitle: getAllBids[index].title,
                sellerId: getUser._id,
                buyerId: max.user._id,
                finalPrice: max.price,
                chatId: chat._id
              },
              getUser._id.toString(),
              `${getUser.firstName} ${getUser.lastName}`,
              getUser.email
            );

            // Send seller notification for sale (DB)
            await this.notificationService.create(
              getUser._id.toString(),
              NotificationType.ITEM_SOLD,
              'Félicitations! Votre article a été vendu',
              `Votre article "${getAllBids[index].title || 'le produit'}" a été vendu à ${getAther.firstName} ${getAther.lastName} pour ${max.price} DA. Un chat a été créé pour finaliser la vente.`,
              {
                bidId: getAllBids[index]._id,
                productTitle: getAllBids[index].title,
                buyerId: max.user._id,
                buyerName: getAther.firstName + ' ' + getAther.lastName,
                finalPrice: max.price,
                chatId: chat._id
              }
            );

            // Add CHAT_CREATED notification for buyer
            await this.notificationService.create(
              max.user._id.toString(),
              NotificationType.CHAT_CREATED,
              'Nouveau chat créé',
              `Un nouveau chat a été créé avec le vendeur ${getUser.firstName} ${getUser.lastName} pour finaliser votre achat de "${getAllBids[index].title || 'le produit'}".`,
              {
                chatId: chat._id,
                sellerName: getUser.firstName + ' ' + getUser.lastName,
                productTitle: getAllBids[index].title
              },
              getUser._id.toString(), // senderId
              `${getUser.firstName} ${getUser.lastName}`, // senderName
              getUser.email // senderEmail
            );

            // Add CHAT_CREATED notification for seller
            await this.notificationService.create(
              getUser._id.toString(),
              NotificationType.CHAT_CREATED,
              'Nouveau chat avec le gagnant',
              `Un nouveau chat a été créé avec l'acheteur ${getAther.firstName} ${getAther.lastName} pour finaliser la vente de "${getAllBids[index].title || 'le produit'}".`,
              {
                chatId: chat._id,
                winnerName: getAther.firstName + ' ' + getAther.lastName,
                productTitle: getAllBids[index].title
              },
              getAther._id.toString(), // senderId
              `${getAther.firstName} ${getAther.lastName}`, // senderName
              getAther.email // senderEmail
            );

            // Send socket notification to winner (buyer)
            this.ChatGateWay.sendBidWonNotificationToUser(
              max.user._id.toString(),
              {
                type: 'BID_WON',
                title: 'Félicitations! Vous avez remporté l\'enchère',
                message: `Vous avez remporté l'enchère pour "${getAllBids[index].title || 'le produit'}". Un chat a été créé avec le vendeur pour finaliser la transaction.`,
                bidId: getAllBids[index]._id,
                chatId: chat._id,
                sellerName: getUser.firstName + ' ' + getUser.lastName,
                productTitle: getAllBids[index].title
              }
            );

            // Send socket notification to seller
            this.ChatGateWay.sendAuctionSoldNotificationToUser(
              getUser._id.toString(),
              {
                type: 'AUCTION_SOLD',
                title: 'Votre enchère a été vendue',
                message: `Votre enchère "${getAllBids[index].title || 'le produit'}" a été remportée par ${getAther.firstName} ${getAther.lastName}. Un chat a été créé avec l\'acheteur pour finaliser la transaction.`,
                bidId: getAllBids[index]._id,
                chatId: chat._id,
                winnerName: getAther.firstName + ' ' + getAther.lastName,
                productTitle: getAllBids[index].title
              }
            );

            this.ChatGateWay.sendNotificationChatCreateToOne(max.user._id.toString())

            // Notify all losing bidders
            for (const offer of getOffers) {
              const offerUserId = offer.user._id ? offer.user._id.toString() : offer.user.toString();
              const winnerUserId = max.user._id ? max.user._id.toString() : max.user.toString();

              // Skip notification for the winner
              if (offerUserId !== winnerUserId) {
                await this.notificationService.create(
                  offerUserId,
                  NotificationType.AUCTION_LOST,
                  'Enchère terminée',
                  `L'enchère "${getAllBids[index].title || 'le produit'}" a été remportée par un autre participant. Merci d'avoir participé !`,
                  {
                    bidId: getAllBids[index]._id,
                    productTitle: getAllBids[index].title,
                    winnerId: winnerUserId,
                    finalPrice: max.price
                  },
                  getUser._id.toString(),
                  `${getUser.firstName} ${getUser.lastName}`,
                  getUser.email
                );
              }
            }

            // Send auction end notification to seller
            //  await this.notificationService.create(
            //    getUser._id.toString(),
            //    NotificationType.BID_CREATED, // You may want to create a new notification type for this
            //    'Votre enchère est terminée',
            //    `Votre enchère "${getAllBids[index].title || 'le produit'}" est maintenant terminée et a été vendue à ${getAther.firstName} ${getAther.lastName}.`,
            //    {
            //      bidId: getAllBids[index]._id,
            //      productTitle: getAllBids[index].title,
            //      winnerName: getAther.firstName + ' ' + getAther.lastName
            //    }
            //  );


            continue

          }

          await this.bidModel.findByIdAndUpdate(getAllBids[index]._id, {
            status: BID_STATUS.CLOSED,
          });




        } else {
          // SERVICE auctions now work like PRODUCT auctions - highest bidder wins
          if (
            getOffers.length != 0 &&
            getAllBids[index].currentPrice >= getAllBids[index].reservePrice
          ) {
            let max = getOffers[0];
            for (let i = 0; i < getOffers.length; i++) {
              if (getOffers[i].price > max.price) {
                max = getOffers[i];
              }
            }
            await this.bidModel.findByIdAndUpdate(getAllBids[index]._id, {
              status: BID_STATUS.ON_AUCTION,
              winner: max.user,
            });
            let users = [getUser._id, max.user._id ? max.user._id : max.user];
            let createdAt = new Date();

            const chat = new this.chatModel({ users, createdAt })
            await chat.save()

            // Send socket notification for new chat to buyer
            this.ChatGateWay.sendNewChatToBuyer(
              max.user._id ? max.user._id.toString() : max.user.toString(),
              {
                type: 'NEW_CHAT',
                title: 'Nouveau chat créé',
                message: `Un nouveau chat a été créé avec le vendeur ${getUser.firstName} ${getUser.lastName} pour finaliser votre achat de "${getAllBids[index].title || 'le service'}".`,
                chatId: chat._id,
                sellerName: getUser.firstName + ' ' + getUser.lastName,
                productTitle: getAllBids[index].title
              }
            );

            // Send socket notification for new chat to seller
            this.ChatGateWay.sendNewChatToSeller(
              getUser._id.toString(),
              {
                type: 'NEW_CHAT',
                title: 'Nouveau chat avec le gagnant',
                message: `Un nouveau chat a été créé avec l'acheteur ${(max.user.firstName || '')} ${(max.user.lastName || '')} pour finaliser la vente de "${getAllBids[index].title || 'le service'}".`,
                chatId: chat._id,
                winnerName: (max.user.firstName || '') + ' ' + (max.user.lastName || ''),
                productTitle: getAllBids[index].title
              }
            );

            // Send winner notification (DB)
            await this.notificationService.create(
              max.user._id ? max.user._id.toString() : max.user.toString(),
              NotificationType.BID_WON,
              'Félicitations! Vous avez remporté l\'enchère',
              `Vous avez remporté l'enchère pour "${getAllBids[index].title || 'le service'}". Un chat a été créé avec le vendeur pour finaliser la transaction.`,
              {
                bidId: getAllBids[index]._id,
                chatId: chat._id,
                sellerName: getUser.firstName + ' ' + getUser.lastName,
                productTitle: getAllBids[index].title
              },
              getUser._id.toString(),
              `${getUser.firstName} ${getUser.lastName}`,
              getUser.email
            );

            // Send seller notification for service sale (DB)
            await this.notificationService.create(
              getUser._id.toString(),
              NotificationType.ITEM_SOLD,
              'Félicitations! Votre service a été vendu',
              `Votre service "${getAllBids[index].title || 'le service'}" a été vendu à ${(max.user.firstName || '')} ${(max.user.lastName || '')} pour ${max.price} DA. Un chat a été créé pour finaliser la vente.`,
              {
                bidId: getAllBids[index]._id,
                productTitle: getAllBids[index].title,
                buyerId: max.user._id ? max.user._id : max.user,
                buyerName: (max.user.firstName || '') + ' ' + (max.user.lastName || ''),
                finalPrice: max.price,
                chatId: chat._id
              }
            );

            // Add CHAT_CREATED notification for buyer
            await this.notificationService.create(
              max.user._id ? max.user._id.toString() : max.user.toString(),
              NotificationType.CHAT_CREATED,
              'Nouveau chat créé',
              `Un nouveau chat a été créé avec le vendeur ${getUser.firstName} ${getUser.lastName} pour finaliser votre achat de "${getAllBids[index].title || 'le service'}".`,
              {
                chatId: chat._id,
                sellerName: getUser.firstName + ' ' + getUser.lastName,
                productTitle: getAllBids[index].title
              },
              getUser._id.toString(), // senderId
              `${getUser.firstName} ${getUser.lastName}`, // senderName
              getUser.email // senderEmail
            );

            // Add CHAT_CREATED notification for seller
            await this.notificationService.create(
              getUser._id.toString(),
              NotificationType.CHAT_CREATED,
              'Nouveau chat avec le gagnant',
              `Un nouveau chat a été créé avec l'acheteur ${(max.user.firstName || '')} ${(max.user.lastName || '')} pour finaliser la vente de "${getAllBids[index].title || 'le service'}".`,
              {
                chatId: chat._id,
                winnerName: (max.user.firstName || '') + ' ' + (max.user.lastName || ''),
                productTitle: getAllBids[index].title
              },
              max.user._id ? max.user._id.toString() : max.user.toString(), // senderId
              `${max.user.firstName || ''} ${max.user.lastName || ''}`, // senderName
              max.user.email // senderEmail
            );

            // Send socket notification to winner (buyer)
            this.ChatGateWay.sendBidWonNotificationToUser(
              max.user._id ? max.user._id.toString() : max.user.toString(),
              {
                type: 'BID_WON',
                title: 'Félicitations! Vous avez remporté l\'enchère',
                message: `Vous avez remporté l'enchère pour "${getAllBids[index].title || 'le service'}". Un chat a été créé avec le vendeur pour finaliser la transaction.`,
                bidId: getAllBids[index]._id,
                chatId: chat._id,
                sellerName: getUser.firstName + ' ' + getUser.lastName,
                productTitle: getAllBids[index].title
              }
            );

            // Send socket notification to seller
            this.ChatGateWay.sendAuctionSoldNotificationToUser(
              getUser._id.toString(),
              {
                type: 'AUCTION_SOLD',
                title: 'Votre enchère a été vendue',
                message: `Votre enchère "${getAllBids[index].title || 'le service'}" a été remportée par ${max.user.firstName || ''} ${max.user.lastName || ''}. Un chat a été créé avec l\'acheteur pour finaliser la transaction.`,
                bidId: getAllBids[index]._id,
                chatId: chat._id,
                winnerName: (max.user.firstName || '') + ' ' + (max.user.lastName || ''),
                productTitle: getAllBids[index].title
              }
            );

            this.ChatGateWay.sendNotificationChatCreateToOne(users[1].toString())

            // Notify all losing bidders
            for (const offer of getOffers) {
              const offerUserId = offer.user._id ? offer.user._id.toString() : offer.user.toString();
              const winnerUserId = max.user._id ? max.user._id.toString() : max.user.toString();

              // Skip notification for the winner
              if (offerUserId !== winnerUserId) {
                await this.notificationService.create(
                  offerUserId,
                  NotificationType.AUCTION_LOST,
                  'Enchère terminée',
                  `L'enchère "${getAllBids[index].title || 'le service'}" a été remportée par un autre participant. Merci d'avoir participé !`,
                  {
                    bidId: getAllBids[index]._id,
                    productTitle: getAllBids[index].title,
                    winnerId: winnerUserId,
                    finalPrice: max.price
                  },
                  getUser._id.toString(),
                  `${getUser.firstName} ${getUser.lastName}`,
                  getUser.email
                );
              }
            }

            // Send auction end notification to seller
            //  await this.notificationService.create(
            //    getUser._id.toString(),
            //    NotificationType.BID_CREATED, // You may want to create a new notification type for this
            //    'Votre enchère est terminée',
            //    `Votre enchère \"${getAllBids[index].title || 'le service'}\" est maintenant terminée et a été vendue à ${(max.user.firstName || '')} ${(max.user.lastName || '')}.`,
            //    {
            //      bidId: getAllBids[index]._id,
            //      productTitle: getAllBids[index].title,
            //      winnerName: (max.user.firstName || '') + ' ' + (max.user.lastName || '')
            //    }
            //  );

            continue

          }

          await this.bidModel.findByIdAndUpdate(getAllBids[index]._id, {
            status: BID_STATUS.CLOSED,
          });


        }

      }
    }
    return;
  }

  async remove(id: string): Promise<Bid> {
    const deletedBid = await this.bidModel.findByIdAndDelete(id).exec();

    if (!deletedBid) {
      const translatedMessage = await this.i18nService.t('BID.NOT_FOUND', {
        args: { id },
      });
      throw new NotFoundException(translatedMessage);
    }

    return deletedBid;
  }

  async findByOwner(ownerId: string): Promise<Bid[]> {
    return this.bidModel.find({ owner: ownerId }).populate('thumbs').exec();
  }

  async findFinishedBidsByOwner(ownerId: string): Promise<Bid[]> {
    return this.bidModel
      .find({
        owner: ownerId,
        status: { $in: [BID_STATUS.CLOSED, BID_STATUS.ON_AUCTION] }
      })
      .populate('thumbs')
      .populate('videos')
      .populate('productCategory')
      .populate('productSubCategory')
      .populate({
        path: 'owner',
        populate: {
          path: 'avatar',
          model: 'Attachment'
        }
      })
      .exec();
  }

  async relaunchBid(relaunchBidDto: RelaunchBidDto, userId: string): Promise<Bid> {
    // console.log('relaunchBid called with:', { relaunchBidDto, userId });

    // First, get the original bid to copy its data
    const originalBid = await this.bidModel
      .findById(relaunchBidDto.originalBidId)
      .populate('productCategory')
      .populate('productSubCategory')
      .populate('thumbs')
      .populate('videos')
      .exec();
    if (!originalBid) {
      throw new NotFoundException('Original bid not found');
    }

    // Debug logging for original bid
    // console.log('Original bid details:', {
    //   _id: originalBid._id,
    //   title: originalBid.title,
    //   status: originalBid.status,
    //   endingAt: originalBid.endingAt,
    //   owner: originalBid.owner
    // });

    // Check if the user owns the original bid
    if (originalBid.owner.toString() !== userId) {
      throw new Error('You can only relaunch your own auctions');
    }

    // Check if the original bid is finished (either by time or status)
    const now = new Date();
    const endTime = new Date(originalBid.endingAt);
    const isTimeFinished = endTime < now;
    const isStatusClosed = originalBid.status === BID_STATUS.CLOSED;

    // Debug logging
    // console.log('Relaunch validation:', {
    //   auctionId: originalBid._id,
    //   status: originalBid.status,
    //   endingAt: originalBid.endingAt,
    //   endTime: endTime,
    //   now: now,
    //   isTimeFinished,
    //   isStatusClosed,
    //   canRelaunch: isTimeFinished || isStatusClosed
    // });

    // Allow relaunch if auction is either time-finished OR status-closed
    if (!isTimeFinished && !isStatusClosed) {
      throw new Error('You can only relaunch finished or closed auctions');
    }

    // Validate dates
    if (relaunchBidDto.startingAt < now) {
      throw new Error('Starting date must be in the future');
    }

    if (relaunchBidDto.endingAt <= relaunchBidDto.startingAt) {
      throw new Error('Ending date must be after starting date');
    }

    // Validate minimum duration (1 hour)
    const duration = relaunchBidDto.endingAt.getTime() - relaunchBidDto.startingAt.getTime();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    if (duration < oneHour) {
      throw new Error('Auction duration must be at least 1 hour');
    }

    // Validate prices
    if (relaunchBidDto.reservePrice && relaunchBidDto.reservePrice <= relaunchBidDto.startingPrice) {
      throw new Error('Reserve price must be higher than starting price');
    }

    if (relaunchBidDto.instantBuyPrice && relaunchBidDto.instantBuyPrice <= relaunchBidDto.startingPrice) {
      throw new Error('Instant buy price must be higher than starting price');
    }

    // Extract ObjectId from populated fields - this is the key fix
    const productCategoryId = originalBid.productCategory?._id || originalBid.productCategory;
    const productSubCategoryId = originalBid.productSubCategory?._id || originalBid.productSubCategory;

    // Validate required fields
    if (!productCategoryId) {
      throw new Error('Product category is required for relaunch');
    }

    // Create new bid data based on original bid and new data
    const newBidData: CreateBidDto = {
      owner: userId,
      title: relaunchBidDto.title,
      description: relaunchBidDto.description,
      quantity: relaunchBidDto.quantity || originalBid.quantity.toString(),
      wilaya: relaunchBidDto.wilaya || originalBid.wilaya.toString(),
      place: relaunchBidDto.place,
      attributes: relaunchBidDto.attributes || originalBid.attributes,
      bidType: originalBid.bidType, // Keep original bid type
      productCategory: productCategoryId.toString(), // Use the extracted ObjectId
      productSubCategory: productSubCategoryId?.toString(), // Use the extracted ObjectId
      thumbs: originalBid.thumbs.map(thumb => thumb._id ? thumb._id.toString() : thumb.toString()), // Handle both populated and unpopulated
      videos: originalBid.videos.map(video => video._id ? video._id.toString() : video.toString()), // Handle both populated and unpopulated
      startingAt: relaunchBidDto.startingAt,
      endingAt: relaunchBidDto.endingAt,
      auctionType: relaunchBidDto.auctionType || originalBid.auctionType,
      startingPrice: relaunchBidDto.startingPrice,
      currentPrice: relaunchBidDto.startingPrice, // Set current price to starting price
      reservePrice: relaunchBidDto.reservePrice,
      instantBuyPrice: relaunchBidDto.instantBuyPrice,
      maxAutoBid: relaunchBidDto.maxAutoBid,
      hidden: relaunchBidDto.hidden || false,
      isPro: relaunchBidDto.isPro,
    };

    try {
      // console.log('Creating new bid with data:', JSON.stringify(newBidData, null, 2));

      // Validate the new bid data before creating
      if (!newBidData.title || !newBidData.description || !newBidData.place) {
        throw new Error('Missing required fields: title, description, or place');
      }

      if (!newBidData.startingPrice || newBidData.startingPrice <= 0) {
        throw new Error('Invalid starting price');
      }

      // Create the new bid
      const createdBid = new this.bidModel(newBidData);
      const savedBid = await createdBid.save();
      const populatedBid = await this.bidModel
        .findById(savedBid._id)
        .populate('productCategory')
        .populate('productSubCategory')
        .populate('thumbs')
        .populate('videos')
        .exec();

      // Get participants from the original auction to send notifications
      try {
        const originalOffers = await this.offerService.getOffersByBidId(relaunchBidDto.originalBidId);

        // Create notification for relaunched bid
        const notificationTitle = 'Enchère Relancée';
        const categoryName = populatedBid.productCategory?.name || 'Inconnue';
        const notificationMessage = `L'enchère "${populatedBid.title}" que vous avez suivie a été relancée dans la catégorie ${categoryName}. Participez dès maintenant !`;

        console.log('Creating notifications for participants...');
        // Create notification for relaunched bid for each participant
        for (const offer of originalOffers) {
          if (offer.user && offer.user._id) {
            try {
              await this.notificationService.create(
                offer.user._id.toString(),
                NotificationType.BID_CREATED,
                notificationTitle,
                notificationMessage,
                populatedBid,
              );
            } catch (notificationError) {
              console.error('Error creating notification for participant:', offer.user._id, notificationError);
              // Continue with other participants even if one fails
            }
          }
        }
      } catch (notificationError) {
        console.error('Error in notification process:', notificationError);
        // Continue without notifications if they fail
      }

      return populatedBid;
    } catch (error) {
      console.error('Error in relaunch process:', error);
      throw error;
    }
  }
}