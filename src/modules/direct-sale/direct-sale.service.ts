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
  ) { }

  async findAll(): Promise<DirectSaleDocument[]> {
    return this.directSaleModel
      .find({ status: DIRECT_SALE_STATUS.ACTIVE, hidden: false })
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
        .populate({ path: 'comments', populate: { path: 'user' } })
        .exec();

      if (!directSale) {
        throw new NotFoundException(`Direct sale with ID "${id}" not found`);
      }

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
    const createdDirectSale = new this.directSaleModel({
      ...createDirectSaleDto,
      soldQuantity: 0,
      status: DIRECT_SALE_STATUS.ACTIVE,
    });

    const savedDirectSale = await createdDirectSale.save();
    const populatedDirectSale = await this.directSaleModel
      .findById(savedDirectSale._id)
      .populate('productCategory')
      .populate('productSubCategory')
      .populate('thumbs')
      .exec();

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

    // Check quantity availability
    if (directSale.quantity > 0) {
      const availableQuantity = directSale.quantity - directSale.soldQuantity;
      if (purchaseDto.quantity > availableQuantity) {
        throw new BadRequestException(
          `Only ${availableQuantity} items available. Requested: ${purchaseDto.quantity}`,
        );
      }
    }

    // Calculate total price
    const totalPrice = directSale.price * purchaseDto.quantity;

    // Create purchase record
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

    // Update sold quantity
    await this.directSaleModel.findByIdAndUpdate(directSale._id, {
      $inc: { soldQuantity: purchaseDto.quantity },
    });

    // Check if sold out
    if (
      directSale.quantity > 0 &&
      directSale.soldQuantity + purchaseDto.quantity >= directSale.quantity
    ) {
      await this.directSaleModel.findByIdAndUpdate(directSale._id, {
        status: DIRECT_SALE_STATUS.SOLD_OUT,
      });
    }

    // Create notification for seller
    const sellerNotificationTitle = 'Nouvelle Commande Reçue';
    const sellerNotificationMessage = `Vous avez reçu une nouvelle commande de ${purchaseDto.quantity} article(s) pour "${directSale.title}"`;

    await this.notificationService.create(
      directSale.owner._id.toString(),
      NotificationType.NEW_OFFER,
      sellerNotificationTitle,
      sellerNotificationMessage,
      { directSale, purchase: savedPurchase },
      buyerId,
      'Buyer',
      '',
    );

    // Create notification for buyer
    const buyerNotificationTitle = 'Commande Confirmée';
    const buyerNotificationMessage = `Votre commande pour "${directSale.title}" a été enregistrée`;

    await this.notificationService.create(
      buyerId,
      NotificationType.NEW_OFFER,
      buyerNotificationTitle,
      buyerNotificationMessage,
      { directSale, purchase: savedPurchase },
      directSale.owner._id.toString(),
      `${directSale.owner?.firstName || 'Seller'} ${directSale.owner?.lastName || ''}`,
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
      .exec();

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    const directSale = purchase.directSale as any;

    // Verify seller owns this direct sale
    if (directSale.owner.toString() !== sellerId) {
      throw new BadRequestException(
        'You are not authorized to confirm this purchase',
      );
    }

    if (purchase.status !== PURCHASE_STATUS.PENDING) {
      throw new BadRequestException('Purchase is not in pending status');
    }

    purchase.status = PURCHASE_STATUS.CONFIRMED;
    purchase.paidAt = new Date();
    await purchase.save();

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

