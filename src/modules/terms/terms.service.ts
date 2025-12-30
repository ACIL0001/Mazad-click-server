import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Terms, TermsDocument } from './schema/terms.schema';
import { CreateTermsDto, UpdateTermsDto } from './dto/terms.dto';

import { AttachmentService } from '../attachment/attachment.service';
import { AttachmentAs } from '../attachment/schema/attachment.schema';

@Injectable()
export class TermsService {
  constructor(
    @InjectModel(Terms.name) private termsModel: Model<TermsDocument>,
    private readonly attachmentService: AttachmentService,
  ) { }

  async create(createTermsDto: CreateTermsDto, adminUserId: string, file?: Express.Multer.File): Promise<Terms> {
    const termsData: any = {
      ...createTermsDto,
      createdBy: adminUserId,
    };

    if (file) {
      const attachment = await this.attachmentService.upload(file, AttachmentAs.TERMS, adminUserId);
      termsData.attachment = attachment._id;
      // If no text content is provided, perhaps use a default message or leave empty
      if (!termsData.content) {
        termsData.content = 'Document attached';
      }
    }

    const createdTerms = new this.termsModel(termsData);
    return createdTerms.save();
  }

  async findAll(): Promise<Terms[]> {
    return this.termsModel.find().populate('attachment').sort({ createdAt: -1 }).exec();
  }

  async findLatest(): Promise<Terms | null> {
    const latestTerms = await this.termsModel
      .findOne()
      .populate('attachment')
      .select('title content version createdAt updatedAt attachment')
      .sort({ createdAt: -1 })
      .exec();

    // Return null with 200 OK when no terms exist instead of throwing 404
    return latestTerms ?? null;
  }

  async findOne(id: string): Promise<Terms> {
    const terms = await this.termsModel.findById(id).exec();
    if (!terms) {
      throw new NotFoundException(`Terms with ID ${id} not found`);
    }
    return terms;
  }

  async update(id: string, updateTermsDto: UpdateTermsDto, adminUserId: string, file?: Express.Multer.File): Promise<Terms> {
    const updateData: any = {
      ...updateTermsDto,
      updatedBy: adminUserId,
    };

    if (file) {
      const attachment = await this.attachmentService.upload(file, AttachmentAs.TERMS, adminUserId);
      updateData.attachment = attachment._id;
    }

    const updatedTerms = await this.termsModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    ).populate('attachment').exec();

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