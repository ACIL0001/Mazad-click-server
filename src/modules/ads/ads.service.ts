import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ad, AdDocument } from './schema/ads.schema';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

@Injectable()
export class AdsService {
  constructor(
    @InjectModel(Ad.name) private adModel: Model<AdDocument>,
  ) {}

  async create(createAdDto: CreateAdDto): Promise<Ad> {
    const createdAd = new this.adModel({
      ...createAdDto,
      isActive: createAdDto.isActive ?? true,
      isDisplayed: createAdDto.isDisplayed ?? false,
      order: createAdDto.order ?? 0,
    });
    return createdAd.save();
  }

  async findAll(): Promise<Ad[]> {
    return this.adModel
      .find()
      .populate('image')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Ad> {
    const ad = await this.adModel
      .findById(id)
      .populate('image')
      .exec();

    if (!ad) {
      throw new NotFoundException(`Ad with ID ${id} not found`);
    }
    return ad;
  }

  async update(id: string, updateAdDto: UpdateAdDto): Promise<Ad> {
    const updatedAd = await this.adModel
      .findByIdAndUpdate(id, updateAdDto, { new: true })
      .populate('image')
      .exec();

    if (!updatedAd) {
      throw new NotFoundException(`Ad with ID ${id} not found`);
    }
    return updatedAd;
  }

  async remove(id: string): Promise<Ad> {
    const deletedAd = await this.adModel.findByIdAndDelete(id).exec();
    if (!deletedAd) {
      throw new NotFoundException(`Ad with ID ${id} not found`);
    }
    return deletedAd;
  }

  async toggleDisplay(id: string, isDisplayed: boolean): Promise<Ad> {
    const ad = await this.adModel
      .findByIdAndUpdate(id, { isDisplayed }, { new: true })
      .populate('image')
      .exec();

    if (!ad) {
      throw new NotFoundException(`Ad with ID ${id} not found`);
    }
    return ad;
  }

  async toggleActive(id: string, isActive: boolean): Promise<Ad> {
    const ad = await this.adModel
      .findByIdAndUpdate(id, { isActive }, { new: true })
      .populate('image')
      .exec();

    if (!ad) {
      throw new NotFoundException(`Ad with ID ${id} not found`);
    }
    return ad;
  }

  async updateOrder(ads: { _id: string; order: number }[]): Promise<Ad[]> {
    const updatePromises = ads.map(({ _id, order }) =>
      this.adModel.findByIdAndUpdate(_id, { order }, { new: true }).populate('image').exec()
    );
    
    const updatedAds = await Promise.all(updatePromises);
    return updatedAds.filter(ad => ad !== null) as Ad[];
  }
}

