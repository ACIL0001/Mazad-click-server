import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AutoBid, AutoBidDocument } from './schema/auto.schema';
import { CreateAutoBidDto } from './dto/create-auto-bid.dto';

@Injectable()
export class AutoBidService {
  constructor(
    @InjectModel(AutoBid.name) private autoBidModel: Model<AutoBidDocument>,
  ) {}

  async createOrUpdateAutoBid(createAutoBidDto: CreateAutoBidDto): Promise<AutoBid> {
    try {
      const { user, bid, price } = createAutoBidDto;

      // Validate input
      if (!user || !bid || !price || price <= 0) {
        throw new BadRequestException('Invalid input data');
      }

      // Check if user already has an auto-bid for this auction
      const existingAutoBid = await this.autoBidModel.findOne({
        user: user,
        bid: bid
      });

      if (existingAutoBid) {
        // Update existing auto-bid
        existingAutoBid.price = price;
        return await existingAutoBid.save();
      } else {
        // Create new auto-bid
        const newAutoBid = new this.autoBidModel({
          user: user,
          bid: bid,
          price: price
        });
        return await newAutoBid.save();
      }
    } catch (error) {
      console.error('Error in createOrUpdateAutoBid:', error);
      throw error;
    }
  }

  async getAutoBidByUserAndBid(userId: string, bidId: string): Promise<AutoBid | null> {
    try {
      return await this.autoBidModel.findOne({
        user: userId,
        bid: bidId
      }).populate('user', 'firstName lastName').populate('bid', 'title currentPrice').exec();
    } catch (error) {
      console.error('Error in getAutoBidByUserAndBid:', error);
      throw error;
    }
  }

  async getAutoBidsByUser(userId: string): Promise<AutoBid[]> {
    try {
      return await this.autoBidModel.find({
        user: userId
      }).populate('bid', 'title currentPrice').exec();
    } catch (error) {
      console.error('Error in getAutoBidsByUser:', error);
      throw error;
    }
  }

  async deleteAutoBid(userId: string, bidId: string): Promise<void> {
    try {
      const result = await this.autoBidModel.deleteOne({
        user: userId,
        bid: bidId
      });
      
      if (result.deletedCount === 0) {
        throw new NotFoundException('Auto-bid not found');
      }
    } catch (error) {
      console.error('Error in deleteAutoBid:', error);
      throw error;
    }
  }

  async getAutoBidsByAuction(bidId: string): Promise<AutoBid[]> {
    try {
      return await this.autoBidModel.find({
        bid: bidId
      }).populate('user', 'firstName lastName email').exec();
    } catch (error) {
      console.error('Error in getAutoBidsByAuction:', error);
      throw error;
    }
  }
} 