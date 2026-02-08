import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DirectSale,
  DirectSaleDocument,
  DirectSalePurchase,
  DirectSalePurchaseDocument,
  DIRECT_SALE_STATUS,
  PURCHASE_STATUS,
} from './schema/direct-sale.schema';
import { CreateDirectSaleDto } from './dto/create-direct-sale.dto';
import { UpdateDirectSaleDto } from './dto/update-direct-sale.dto';
import { PurchaseDirectSaleDto } from './dto/purchase-direct-sale.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';
import { ClientService } from '../user/services/client.service';
import { AttachmentService } from '../attachment/attachment.service';
import { ChatService } from '../chat/chat.service';
import { UserService } from '../user/user.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class DirectSaleService {
  constructor(
    @InjectModel(DirectSale.name)
    private directSaleModel: Model<DirectSaleDocument>,
    @InjectModel(DirectSalePurchase.name)
    private directSalePurchaseModel: Model<DirectSalePurchaseDocument>,
    private notificationService: NotificationService,
    private clientService: ClientService,
    private attachmentService: AttachmentService,
    private chatService: ChatService,
    private userService: UserService,
    private searchService: SearchService,
  ) { }

  async findAll(user?: any): Promise<DirectSaleDocument[]> {
    const query: any = {
      status: { $nin: [DIRECT_SALE_STATUS.ARCHIVED, DIRECT_SALE_STATUS.INACTIVE] }
    };

    // If not professional, only show items NOT marked as professionalOnly
    const isProfessional = user?.type === 'PROFESSIONAL';
    if (!isProfessional) {
      query.professionalOnly = { $ne: true };
    }

    return this.directSaleModel
      .find(query)
      .populate({
        path: 'owner',
        populate: {
          path: 'avatar',
          model: 'Attachment',
        },
      })
      .populate('thumbs')
      .populate('videos')
      .populate('productCategory')
      .populate('productSubCategory')
      .exec();
  }

  async findAllForAdmin(): Promise<DirectSaleDocument[]> {
    return this.directSaleModel
      .find()
      .populate({
        path: 'owner',
        populate: {
          path: 'avatar',
          model: 'Attachment',
        },
      })
      .populate('thumbs')
      .populate('videos')
      .populate('productCategory')
      .populate('productSubCategory')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<DirectSaleDocument> {
    try {
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        throw new NotFoundException(`Invalid direct sale ID format: "${id}"`);
      }

      const directSale = await this.directSaleModel
        .findById(id)
        .populate('thumbs')
        .populate('videos')
        .populate({
          path: 'owner',
          populate: {
            path: 'avatar',
            model: 'Attachment',
          },
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

      if (!directSale) {
        throw new NotFoundException(`Direct sale with ID "${id}" not found`);
      }

      // DEBUG: Log contactNumber from database
      console.log('🗄️ [SERVICE] Direct Sale from DB:', {
        id: directSale._id,
        title: directSale.title,
        contactNumber: directSale.contactNumber,
        hasContactNumber: !!directSale.contactNumber,
      });

      return directSale;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error in directSaleService.findOne:', error);
      throw new NotFoundException(`Error retrieving direct sale with ID "${id}"`);
    }
  }

  async findByOwner(ownerId: string): Promise<DirectSaleDocument[]> {
    return this.directSaleModel
      .find({ owner: ownerId })
      .populate('thumbs')
      .populate('videos')
      .populate('productCategory')
      .populate('productSubCategory')
      .exec();
  }

  async create(createDirectSaleDto: CreateDirectSaleDto): Promise<DirectSale> {
    console.log('Creating direct sale:', createDirectSaleDto.title);
    console.log('Direct sale DTO thumbs (type:', typeof createDirectSaleDto.thumbs, ', isArray:', Array.isArray(createDirectSaleDto.thumbs), '):', createDirectSaleDto.thumbs);
    console.log('Direct sale DTO videos (type:', typeof createDirectSaleDto.videos, ', isArray:', Array.isArray(createDirectSaleDto.videos), '):', createDirectSaleDto.videos);
    console.log('Direct sale DTO thumbs length:', createDirectSaleDto.thumbs?.length || 0);
    console.log('Direct sale DTO videos length:', createDirectSaleDto.videos?.length || 0);

    // Ensure thumbs and videos are arrays
    if (!Array.isArray(createDirectSaleDto.thumbs)) {
      console.warn('WARNING: thumbs is not an array, converting:', createDirectSaleDto.thumbs);
      createDirectSaleDto.thumbs = createDirectSaleDto.thumbs ? [createDirectSaleDto.thumbs] : [];
    }
    if (!Array.isArray(createDirectSaleDto.videos)) {
      console.warn('WARNING: videos is not an array, converting:', createDirectSaleDto.videos);
      createDirectSaleDto.videos = createDirectSaleDto.videos ? [createDirectSaleDto.videos] : [];
    }

    const createdDirectSale = new this.directSaleModel({
      ...createDirectSaleDto,
      soldQuantity: 0,
      status: DIRECT_SALE_STATUS.ACTIVE,
    });
    console.log('Direct sale model before save - thumbs (raw):', createdDirectSale.thumbs);
    console.log('Direct sale model before save - thumbs (type):', typeof createdDirectSale.thumbs, Array.isArray(createdDirectSale.thumbs));
    console.log('Direct sale model before save - thumbs (length):', createdDirectSale.thumbs?.length || 0);

    const savedDirectSale = await createdDirectSale.save();
    console.log('Direct sale saved - thumbs (raw):', savedDirectSale.thumbs);
    console.log('Direct sale saved - thumbs (type):', typeof savedDirectSale.thumbs, Array.isArray(savedDirectSale.thumbs));
    console.log('Direct sale saved - thumbs (length):', savedDirectSale.thumbs?.length || 0);

    // Verify the saved direct sale has thumbs
    const verificationDirectSale = await this.directSaleModel.findById(savedDirectSale._id).select('thumbs videos').lean();
    console.log('Verification query - thumbs:', verificationDirectSale?.thumbs);
    console.log('Verification query - thumbs length:', verificationDirectSale?.thumbs?.length || 0);
    const populatedDirectSale = await this.directSaleModel
      .findById(savedDirectSale._id)
      .populate('productCategory')
      .populate('productSubCategory')
      .populate('thumbs')
      .exec();

    // Remove broadcast notification to all buyers as per user request
    // Notifications should only be sent to the creator upon successful creation

    /*
    // Get all buyers (clients) to send notifications
    const buyers = await this.clientService.findAllSellers();

    // Send notification to buyers about new direct sale
    const notificationTitle = 'Nouvelle Vente Directe Disponible';
    const categoryName =
      populatedDirectSale.productCategory?.name || 'Inconnue';
    if (!populatedDirectSale.productCategory) {
      console.warn(
        'Direct sale created without a valid productCategory:',
        populatedDirectSale,
      );
    }
    const notificationMessage = `Une nouvelle vente directe dans la catégorie ${categoryName} est maintenant disponible. Achetez dès maintenant !`;

    // Create notification for new direct sale for each buyer
    for (const buyer of buyers) {
      await this.notificationService.create(
        buyer._id.toString(),
        NotificationType.BID_CREATED, // Reusing existing notification type
        notificationTitle,
        notificationMessage,
        populatedDirectSale,
        populatedDirectSale.owner?._id?.toString(),
        `${populatedDirectSale.owner?.firstName || 'Unknown'} ${populatedDirectSale.owner?.lastName || 'User'}`,
        populatedDirectSale.owner?.email,
      );
    }
    */

    // Send confirmation notification to direct sale creator
    if (populatedDirectSale.owner && populatedDirectSale.owner._id) {
      await this.notificationService.create(
        populatedDirectSale.owner._id.toString(),
        NotificationType.DIRECT_SALE_CREATED,
        'Vente directe créée avec succès',
        `Votre vente directe "${populatedDirectSale.title}" a été créée avec succès et est maintenant disponible pour les acheteurs.`,
        populatedDirectSale,
        populatedDirectSale.owner._id.toString(),
        `${populatedDirectSale.owner?.firstName || 'Unknown'} ${populatedDirectSale.owner?.lastName || 'User'}`,
        populatedDirectSale.owner?.email,
      );
    }

    // Check if any users were looking for this item
    console.log('📢 Checking for interested users for direct sale:', populatedDirectSale.title);
    this.searchService.notifyInterestedUsers(
      populatedDirectSale.title,
      populatedDirectSale.description || '',
      'direct-sale',
      populatedDirectSale._id.toString()
    ).catch(err => console.error('Error notifying interested users:', err));

    return populatedDirectSale;
  }

  async update(
    id: string,
    updateDirectSaleDto: UpdateDirectSaleDto,
  ): Promise<DirectSale> {
    const updatedDirectSale = await this.directSaleModel
      .findByIdAndUpdate(id, updateDirectSaleDto, { new: true })
      .exec();

    if (!updatedDirectSale) {
      throw new NotFoundException(`Direct sale with ID "${id}" not found`);
    }

    return updatedDirectSale;
  }

  async delete(id: string): Promise<void> {
    const result = await this.directSaleModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Direct sale with ID "${id}" not found`);
    }
  }

  async purchase(
    purchaseDto: PurchaseDirectSaleDto,
    buyerId: string,
  ): Promise<DirectSalePurchase> {
    const directSale = await this.findOne(purchaseDto.directSaleId);

    if (!directSale) {
      throw new NotFoundException('Direct sale not found');
    }

    if (directSale.status !== DIRECT_SALE_STATUS.ACTIVE) {
      throw new BadRequestException('This direct sale is not available');
    }

    // Check if seller is trying to buy their own product
    if (directSale.owner._id.toString() === buyerId) {
      throw new BadRequestException(
        'You cannot purchase your own direct sale',
      );
    }

    // Check quantity availability (considering pending purchases that will be confirmed)
    if (directSale.quantity > 0) {
      // Get all pending purchases for this direct sale
      const pendingPurchases = await this.directSalePurchaseModel
        .find({
          directSale: directSale._id,
          status: PURCHASE_STATUS.PENDING,
        })
        .exec();

      const pendingQuantity = pendingPurchases.reduce(
        (sum, p) => sum + p.quantity,
        0,
      );

      const availableQuantity = directSale.quantity - directSale.soldQuantity - pendingQuantity;
      if (purchaseDto.quantity > availableQuantity) {
        throw new BadRequestException(
          `Only ${availableQuantity} items available. Requested: ${purchaseDto.quantity}`,
        );
      }
    }

    // Calculate total price
    const totalPrice = directSale.price * purchaseDto.quantity;

    // Create purchase record (DO NOT update soldQuantity here - wait for confirmation)
    const purchase = new this.directSalePurchaseModel({
      directSale: directSale._id,
      buyer: buyerId,
      seller: directSale.owner._id.toString(),
      quantity: purchaseDto.quantity,
      unitPrice: directSale.price,
      totalPrice: totalPrice,
      status: PURCHASE_STATUS.PENDING,
      paymentMethod: purchaseDto.paymentMethod,
      paymentReference: purchaseDto.paymentReference,
    });

    const savedPurchase = await purchase.save();

    // DO NOT update soldQuantity here - it will be updated when seller confirms the purchase

    // Create enhanced notification for seller
    const sellerNotificationTitle = `Nouvelle Commande - ${totalPrice} DA`;
    const sellerNotificationMessage = `${purchaseDto.quantity} article(s) de "${directSale.title}"${purchaseDto.paymentMethod ? ` • ${purchaseDto.paymentMethod}` : ''}`;

    await this.notificationService.create(
      directSale.owner._id.toString(),
      NotificationType.ORDER_RECEIVED,
      sellerNotificationTitle,
      sellerNotificationMessage,
      {
        directSale: {
          _id: directSale._id,
          title: directSale.title,
          price: directSale.price
        },
        purchase: {
          _id: savedPurchase._id,
          quantity: purchaseDto.quantity,
          unitPrice: directSale.price,
          totalPrice: totalPrice,
          paymentMethod: purchaseDto.paymentMethod,
          paymentReference: purchaseDto.paymentReference,
          status: savedPurchase.status
        },
        buyerId: buyerId
      },
      buyerId,
      'Acheteur',
      '',
    );

    // Create enhanced notification for buyer
    const buyerNotificationTitle = `Commande Effectuée - ${totalPrice} DA`;
    const buyerNotificationMessage = `Vous avez effectué une commande de ${purchaseDto.quantity} article(s) de "${directSale.title}". En attente de confirmation du vendeur.${purchaseDto.paymentMethod ? ` • ${purchaseDto.paymentMethod}` : ''}`;

    await this.notificationService.create(
      buyerId,
      NotificationType.ORDER,
      buyerNotificationTitle,
      buyerNotificationMessage,
      {
        directSale: {
          _id: directSale._id,
          title: directSale.title,
          price: directSale.price
        },
        purchase: {
          _id: savedPurchase._id,
          quantity: purchaseDto.quantity,
          unitPrice: directSale.price,
          totalPrice: totalPrice,
          paymentMethod: purchaseDto.paymentMethod,
          paymentReference: purchaseDto.paymentReference,
          status: savedPurchase.status
        },
        sellerId: directSale.owner._id.toString(),
        sellerName: `${directSale.owner?.firstName || 'Vendeur'} ${directSale.owner?.lastName || ''}`
      },
      directSale.owner._id.toString(),
      `${directSale.owner?.firstName || 'Vendeur'} ${directSale.owner?.lastName || ''}`,
      directSale.owner?.email,
    );

    return savedPurchase;
  }

  async confirmPurchase(
    purchaseId: string,
    sellerId: string,
  ): Promise<DirectSalePurchase> {
    const purchase = await this.directSalePurchaseModel
      .findById(purchaseId)
      .populate('directSale')
      .populate('buyer')
      .exec();

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    const directSale = purchase.directSale as any;
    const buyer = purchase.buyer as any;

    // Verify seller owns this direct sale
    if (directSale.owner.toString() !== sellerId) {
      throw new BadRequestException(
        'You are not authorized to confirm this purchase',
      );
    }

    if (purchase.status !== PURCHASE_STATUS.PENDING) {
      throw new BadRequestException('Purchase is not in pending status');
    }

    // Update sold quantity when purchase is confirmed
    await this.directSaleModel.findByIdAndUpdate(directSale._id, {
      $inc: { soldQuantity: purchase.quantity },
    });

    // Check if sold out after confirmation
    const updatedDirectSale = await this.directSaleModel.findById(directSale._id).exec();
    if (
      updatedDirectSale &&
      updatedDirectSale.quantity > 0 &&
      updatedDirectSale.soldQuantity >= updatedDirectSale.quantity
    ) {
      await this.directSaleModel.findByIdAndUpdate(directSale._id, {
        status: DIRECT_SALE_STATUS.SOLD_OUT,
      });
    }

    purchase.status = PURCHASE_STATUS.CONFIRMED;
    purchase.paidAt = new Date();
    await purchase.save();

    // Create chat between seller and buyer
    let chatId = null;
    try {
      const sellerUser = await this.userService.findOne(sellerId);
      const buyerUser = await this.userService.findOne(buyer._id.toString());

      if (sellerUser && buyerUser) {
        // Prepare users in the format ChatService expects (IUser[])
        const chatUsers = [
          {
            _id: sellerUser._id.toString(),
            AccountType: sellerUser.AccountType,
            firstName: sellerUser.firstName,
            lastName: sellerUser.lastName,
            phone: sellerUser.phone || '',
          },
          {
            _id: buyerUser._id.toString(),
            AccountType: buyerUser.AccountType,
            firstName: buyerUser.firstName,
            lastName: buyerUser.lastName,
            phone: buyerUser.phone || '',
          }
        ];

        const chat = await this.chatService.create(chatUsers, new Date().toISOString());
        chatId = chat._id.toString();
        console.log(`✅ Chat created between ${sellerUser.firstName} and ${buyerUser.firstName} (ID: ${chatId})`);
      }
    } catch (chatError) {
      console.error('❌ Error creating chat on confirm purchase:', chatError);
      // Failsafe: Continue without chat, just log error
    }

    // Create notification for buyer when order is confirmed
    if (buyer && buyer._id) {
      const totalPrice = purchase.quantity * purchase.unitPrice;
      const buyerNotificationTitle = `Commande Confirmée - ${totalPrice} DA`;
      const buyerNotificationMessage = `Votre commande a été confirmée. Félicitations! Vous pouvez maintenant discuter avec le vendeur.`;

      await this.notificationService.create(
        buyer._id.toString(),
        NotificationType.ORDER,
        buyerNotificationTitle,
        buyerNotificationMessage,
        {
          directSale: {
            _id: directSale._id,
            title: directSale.title,
            price: directSale.price
          },
          purchase: {
            _id: purchase._id,
            quantity: purchase.quantity,
            unitPrice: purchase.unitPrice,
            totalPrice: totalPrice,
            status: purchase.status
          },
          sellerId: sellerId,
          sellerName: `${directSale.owner?.firstName || 'Vendeur'} ${directSale.owner?.lastName || ''}`,
          buyerId: buyer._id.toString(),
          chatId: chatId // Include chat ID for redirection
        },
        sellerId,
        `${directSale.owner?.firstName || 'Vendeur'} ${directSale.owner?.lastName || ''}`,
        directSale.owner?.email || '',
      );
    }

    // Create notification for seller when order is confirmed
    const totalPrice = purchase.quantity * purchase.unitPrice;
    const sellerNotificationTitle = `Commande Confirmée - ${totalPrice} DA`;
    const sellerNotificationMessage = `Vous avez confirmé la commande de ${purchase.quantity} article(s) de "${directSale.title}" de ${buyer?.firstName || 'Acheteur'} ${buyer?.lastName || ''}. Vous pouvez maintenant discuter avec l'acheteur.`;

    await this.notificationService.create(
      sellerId,
      NotificationType.ORDER,
      sellerNotificationTitle,
      sellerNotificationMessage,
      {
        directSale: {
          _id: directSale._id,
          title: directSale.title,
          price: directSale.price
        },
        purchase: {
          _id: purchase._id,
          quantity: purchase.quantity,
          unitPrice: purchase.unitPrice,
          totalPrice: totalPrice,
          status: purchase.status
        },
        sellerId: sellerId,
        sellerName: `${directSale.owner?.firstName || 'Vendeur'} ${directSale.owner?.lastName || ''}`,
        buyerId: buyer?._id?.toString() || '',
        buyerName: `${buyer?.firstName || 'Acheteur'} ${buyer?.lastName || ''}`,
        chatId: chatId // Include chat ID for redirection
      },
      buyer?._id?.toString() || '',
      `${buyer?.firstName || 'Acheteur'} ${buyer?.lastName || ''}`,
      buyer?.email || '',
    );

    return purchase;
  }

  async getPurchasesByBuyer(buyerId: string): Promise<DirectSalePurchase[]> {
    return this.directSalePurchaseModel
      .find({ buyer: buyerId })
      .populate('directSale')
      .populate('seller')
      .exec();
  }

  async getPurchasesBySeller(sellerId: string): Promise<DirectSalePurchase[]> {
    return this.directSalePurchaseModel
      .find({ seller: sellerId })
      .populate('directSale')
      .populate('buyer')
      .exec();
  }

  async getPurchasesByDirectSale(
    directSaleId: string,
  ): Promise<DirectSalePurchase[]> {
    return this.directSalePurchaseModel
      .find({ directSale: directSaleId })
      .populate('buyer')
      .exec();
  }
}

