import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubCategory, SubCategoryDocument } from './schema/subcategory.schema';
import { CreateSubCategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubCategoryDto } from './dto/update-subcategory.dto';
import { AttachmentService } from '../attachment/attachment.service';
import { AttachmentAs } from '../attachment/schema/attachment.schema';

@Injectable()
export class SubCategoryService {
  constructor(
    @InjectModel(SubCategory.name) private subCategoryModel: Model<SubCategoryDocument>, // Renamed categoryModel to subCategoryModel for clarity
    // AttachmentService is no longer directly used for uploads in create method here
    // private readonly attachmentService: AttachmentService,
  ) {}

  async create(
    createSubCategoryDto: CreateSubCategoryDto, // Renamed parameter for clarity
    // file?: Express.Multer.File, // Parameter removed
    // userId?: string // Parameter removed
  ): Promise<SubCategory> {
    // const subCategoryData = { ...createSubCategoryDto }; // Directly use DTO

    // File upload logic is now handled in the controller.
    // The controller will populate CreateSubCategoryDto.thumb with the attachment ID if a file was uploaded.
    // if (file) {
    //   if (!userId) {
    //     throw new Error('userId is required when uploading an image');
    //   }
    //   const attachment = await this.attachmentService.upload(
    //     file,
    //     userId,
    //     AttachmentAs.CATEGORY
    //   );
    //   subCategoryData.thumb = String(attachment._id);
    // }

    // Filter out null or empty string attributes before saving
    if (createSubCategoryDto.attributes) {
      createSubCategoryDto.attributes = createSubCategoryDto.attributes.filter(attr => attr && attr.trim() !== '');
    }

    const createdSubCategory = new this.subCategoryModel(createSubCategoryDto); // Use subCategoryModel
    return createdSubCategory.save();
  }

  async findAll(): Promise<SubCategory[]> {
    return this.subCategoryModel.find().populate('thumb').exec(); // Use subCategoryModel
  }

  async findOne(id: string): Promise<SubCategory> {
    const subCategory = await this.subCategoryModel.findById(id).populate('thumb').exec(); // Use subCategoryModel

    if (!subCategory) {
      throw new NotFoundException(`SubCategory with ID ${id} not found`); // Changed message
    }
    return subCategory;
  }

  async update(
    id: string,
    updateSubCategoryDto: UpdateSubCategoryDto, // Renamed parameter for clarity
  ): Promise<SubCategory> {
    // Filter out null or empty string attributes for updates too
    if (updateSubCategoryDto.attributes) {
      updateSubCategoryDto.attributes = updateSubCategoryDto.attributes.filter(attr => attr && attr.trim() !== '');
    }

    const updatedSubCategory = await this.subCategoryModel // Use subCategoryModel
      .findByIdAndUpdate(id, updateSubCategoryDto, { new: true })
      .exec();

    if (!updatedSubCategory) {
      throw new NotFoundException(`SubCategory with ID ${id} not found`); // Changed message
    }
    return updatedSubCategory;
  }

  async remove(id: string): Promise<SubCategory> {
    const deletedSubCategory = await this.subCategoryModel.findByIdAndDelete(id).exec(); 

    if (!deletedSubCategory) {
      throw new NotFoundException(`SubCategory with ID ${id} not found`); 
    }
    return deletedSubCategory;
  }
}
