import {
  Controller,
  Get,
  Post,
  Body,
  Patch, 
  Param,
  Delete,
  UploadedFile, 
  Request,
  BadRequestException,
  UseInterceptors 
} from '@nestjs/common';
import { SubCategoryService } from './subcategory.service';
import { SubCategory } from './schema/subcategory.schema';
import { CreateSubCategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubCategoryDto } from './dto/update-subcategory.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { AttachmentService } from '../attachment/attachment.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Multer } from 'multer';
import { AttachmentAs } from '../attachment/schema/attachment.schema';
import { CategoryService } from '../category/category.service';


// Helper to transform attachment to minimal shape
function transformAttachment(att) {
  if (!att) return null;
  return att.url ? { url: att.url, _id: att._id, filename: att.filename } : null;
}


@ApiTags('SubCategories')
@Controller('subcategory')
@Public()
export class SubCategoryController {
  constructor(
    private readonly subcategoryService: SubCategoryService,
    private readonly attachmentService: AttachmentService, // Keep AttachmentService
    private readonly categoryService: CategoryService, // Inject CategoryService
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', { // 'image' should match the formData.append('image', ...) key from frontend
    storage: diskStorage({
      destination: './uploads', // Ensure this directory exists and is writable
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  async create(
    @UploadedFile() image: Express.Multer.File,
    @Body('data') dataString: string, // Expecting JSON string under 'data' key
    @Request() req
  ) {
    try {
      let createSubCategoryDto: CreateSubCategoryDto;
      try {
        createSubCategoryDto = JSON.parse(dataString);
      } catch (error) {
        throw new BadRequestException('Invalid data format');
      }
      if (image) {
        const userId = req.session?.user?._id || null; // Adjust based on your auth setup
        const attachment = await this.attachmentService.upload(image, AttachmentAs.SUBCATEGORY, userId);
        createSubCategoryDto.thumb = String(attachment._id);
      }
      return await this.subcategoryService.create(createSubCategoryDto);
    } catch (err) {
      console.error('Error in subcategory creation:', err);
      throw err;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all subcategories' })
  @ApiResponse({
    status: 200,
    description: 'List of all subcategories',
    type: [SubCategory],
  })
  async findAll(): Promise<any[]> {
    const subcategories = await this.subcategoryService.findAll();
    return subcategories.map(subCategory => ({
      ...JSON.parse(JSON.stringify(subCategory)),
      thumb: transformAttachment(subCategory.thumb),
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subcategory by ID' })
  @ApiParam({ name: 'id', description: 'SubCategory ID' })
  @ApiResponse({ status: 200, description: 'SubCategory found', type: SubCategory })
  @ApiResponse({ status: 404, description: 'SubCategory not found' })
  async findOne(@Param('id') id: string): Promise<any> {
    const subCategory = await this.subcategoryService.findOne(id);
    return {
      ...JSON.parse(JSON.stringify(subCategory)),
      thumb: transformAttachment(subCategory.thumb),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a subcategory' })
  @ApiParam({ name: 'id', description: 'SubCategory ID' })
  @ApiResponse({
    status: 200,
    description: 'SubCategory updated successfully',
    type: SubCategory,
  })
  @ApiResponse({ status: 404, description: 'SubCategory not found' })
  @UseInterceptors(FileInterceptor('image', { // 'image' should match the formData.append('image', ...) key
    storage: diskStorage({
      destination: './uploads', // Ensure this directory exists and is writable
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  async update( // Changed to async
    @Param('id') id: string,
    @UploadedFile() image: Express.Multer.File, // Get the uploaded file
    @Body('data') dataString: string, // Get the JSON data string
    @Request() req // To potentially get userId for attachment
  ): Promise<SubCategory> {
    try {
      let updateSubCategoryDto: UpdateSubCategoryDto;
      try {
        updateSubCategoryDto = JSON.parse(dataString);
      } catch (error) {
        throw new BadRequestException('Invalid data format for subcategory update');
      }
      // Handle image update/deletion
      if (image) {
        const userId = req.session?.user?._id || null; 
        const attachment = await this.attachmentService.upload(image, AttachmentAs.SUBCATEGORY, userId);
        updateSubCategoryDto.thumb = String(attachment._id); 
      } else if (dataString.includes('"image":"null"')) { 
        updateSubCategoryDto.thumb = null; 
      }
      return await this.subcategoryService.update(id, updateSubCategoryDto);
    } catch (err) {
      console.error('Error in subcategory update:', err);
      throw err;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subcategory' })
  @ApiParam({ name: 'id', description: 'SubCategory ID' })
  @ApiResponse({
    status: 200,
    description: 'SubCategory deleted successfully',
    type: SubCategory,
  })
  @ApiResponse({ status: 404, description: 'SubCategory not found' })
  remove(@Param('id') id: string): Promise<SubCategory> {
    return this.subcategoryService.remove(id);
  }
}
