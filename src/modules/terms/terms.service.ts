import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Terms, TermsDocument } from './schema/terms.schema';
import { CreateTermsDto, UpdateTermsDto } from './dto/terms.dto';

@Injectable()
export class TermsService {
  constructor(
    @InjectModel(Terms.name) private termsModel: Model<TermsDocument>,
  ) {}

  async create(createTermsDto: CreateTermsDto, adminUserId: string): Promise<Terms> {
    const createdTerms = new this.termsModel({
      ...createTermsDto,
      createdBy: adminUserId,
    });
    return createdTerms.save();
  }

  async findAll(): Promise<Terms[]> {
    return this.termsModel.find().sort({ createdAt: -1 }).exec();
  }

  async findLatest(): Promise<Terms | null> {
    const latestTerms = await this.termsModel
      .findOne()
      .select('title content version createdAt updatedAt')
      .sort({ createdAt: -1 })
      .exec();

    return latestTerms;
  }

  async findOne(id: string): Promise<Terms> {
    const terms = await this.termsModel.findById(id).exec();
    if (!terms) {
      throw new NotFoundException(`Terms with ID ${id} not found`);
    }
    return terms;
  }

  async update(id: string, updateTermsDto: UpdateTermsDto, adminUserId: string): Promise<Terms> {
    const updatedTerms = await this.termsModel.findByIdAndUpdate(
      id,
      {
        ...updateTermsDto,
        updatedBy: adminUserId,
      },
      { new: true },
    ).exec();

    if (!updatedTerms) {
      throw new NotFoundException(`Terms with ID ${id} not found`);
    }
    return updatedTerms;
  }

  async remove(id: string): Promise<void> {
    const result = await this.termsModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Terms with ID ${id} not found`);
    }
  }
}