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
  UseInterceptors,
  Query 
} from '@nestjs/common';
import { Express } from 'express';
import { CategoryService } from './category.service';
import { Category } from './schema/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto'; 
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MoveCategoryDto } from './dto/move-category.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { AttachmentService } from '../attachment/attachment.service'; 
import { FileInterceptor } from '@nestjs/platform-express'; 
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Multer } from 'multer'; 
import { AttachmentAs } from '../attachment/schema/attachment.schema'; 

// Helper to transform attachment to minimal shape
function transformAttachment(att) {
  if (!att) return null;
  return att.url ? { url: att.url, _id: att._id, filename: att.filename } : null;
}

@ApiTags('Categories')
@Controller('category')
@Public()
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly attachmentService: AttachmentService, 
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads', 
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, description: 'Category created successfully', type: Category })
  async create(
    @UploadedFile() image: Express.Multer.File,
    @Body('data') dataString: string, 
    @Request() req
  ) {
    try {
      let createCategoryDto: CreateCategoryDto;
      try {
        createCategoryDto = JSON.parse(dataString);
      } catch (error) {
        throw new BadRequestException('Invalid data format for category creation');
      }

      if (image) {
        const userId = req.session?.user?._id || null;
        const attachment = await this.attachmentService.upload(image, AttachmentAs.CATEGORY, userId);
        createCategoryDto.thumb = String(attachment._id);
      }

      return await this.categoryService.create(createCategoryDto);
    } catch (err) {
      console.error('Error in category creation:', err);
      throw err;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({
    status: 200,
    description: 'List of all categories',
    type: [Category],
  })
  async findAll(): Promise<any[]> {
    const categories = await this.categoryService.findAll();
    return categories.map(category => ({
      ...JSON.parse(JSON.stringify(category)),
      thumb: transformAttachment(category.thumb),
    }));
  }

  @Get('roots')
  @ApiOperation({ summary: 'Get root categories (categories without parent)' })
  @ApiResponse({
    status: 200,
    description: 'List of root categories',
    type: [Category],
  })
  async findRootCategories(): Promise<any[]> {
    const categories = await this.categoryService.findRootCategories();
    return categories.map(category => ({
      ...JSON.parse(JSON.stringify(category)),
      thumb: transformAttachment(category.thumb),
    }));
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get complete category tree with nested subcategories' })
  @ApiResponse({
    status: 200,
    description: 'Hierarchical tree of categories',
  })
  async findCategoryTree(): Promise<any[]> {
    const tree = await this.categoryService.findCategoryTree();
    return tree.map(category => this.transformCategoryTree(category));
  }

  private transformCategoryTree(category: any): any {
    return {
      ...category,
      thumb: transformAttachment(category.thumb),
      children: category.children ? category.children.map(child => this.transformCategoryTree(child)) : [],
    };
  }

  @Get('by-parent')
  @ApiOperation({ summary: 'Get categories by parent ID' })
  @ApiQuery({ name: 'parentId', required: false, description: 'Parent category ID (omit for root categories)' })
  @ApiResponse({
    status: 200,
    description: 'List of categories with specified parent',
    type: [Category],
  })
  async findByParent(@Query('parentId') parentId?: string): Promise<any[]> {
    const categories = await this.categoryService.findByParent(parentId);
    return categories.map(category => ({
      ...JSON.parse(JSON.stringify(category)),
      thumb: transformAttachment(category.thumb),
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category found', type: Category })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id') id: string): Promise<any> {
    const category = await this.categoryService.findOne(id);
    return {
      ...JSON.parse(JSON.stringify(category)),
      thumb: transformAttachment(category.thumb),
    };
  }

  @Get(':id/with-ancestors')
  @ApiOperation({ summary: 'Get a category with its ancestors (parent hierarchy)' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category with ancestors' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findWithAncestors(@Param('id') id: string): Promise<any> {
    const result = await this.categoryService.findWithAncestors(id);
    return {
      category: {
        ...JSON.parse(JSON.stringify(result.category)),
        thumb: transformAttachment(result.category.thumb),
      },
      ancestors: result.ancestors.map(ancestor => ({
        ...JSON.parse(JSON.stringify(ancestor)),
        thumb: transformAttachment(ancestor.thumb),
      })),
    };
  }

  @Get(':id/with-descendants')
  @ApiOperation({ summary: 'Get a category with all its descendants (subcategories at all levels)' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category with descendants' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findWithDescendants(@Param('id') id: string): Promise<any> {
    const result = await this.categoryService.findWithDescendants(id);
    return {
      category: {
        ...JSON.parse(JSON.stringify(result.category)),
        thumb: transformAttachment(result.category.thumb),
      },
      descendants: result.descendants.map(descendant => ({
        ...JSON.parse(JSON.stringify(descendant)),
        thumb: transformAttachment(descendant.thumb),
      })),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully',
    type: Category,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  async update(
    @Param('id') id: string,
    @UploadedFile() image: Express.Multer.File,
    @Body('data') dataString: string,
    @Request() req
  ): Promise<Category> {
    try {
      let updateCategoryDto: UpdateCategoryDto;
      try {
        updateCategoryDto = JSON.parse(dataString);
      } catch (error) {
        throw new BadRequestException('Invalid data format for category update');
      }

      if (image) {
        const userId = req.session?.user?._id || null;
        const attachment = await this.attachmentService.upload(image, AttachmentAs.CATEGORY, userId);
        updateCategoryDto.thumb = String(attachment._id);
      } else if (dataString.includes('"image":"null"')) { 
        updateCategoryDto.thumb = null; 
      }

      return await this.categoryService.update(id, updateCategoryDto);
    } catch (err) {
      console.error('Error in category update:', err);
      throw err;
    }
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move a category to a different parent' })
  @ApiParam({ name: 'id', description: 'Category ID to move' })
  @ApiResponse({
    status: 200,
    description: 'Category moved successfully',
    type: Category,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Invalid move operation (e.g., circular reference)' })
  async moveCategory(
    @Param('id') id: string,
    @Body() moveCategoryDto: MoveCategoryDto
  ): Promise<Category> {
    return await this.categoryService.moveCategory(id, moveCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category (only if it has no subcategories)' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category deleted successfully',
    type: Category,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Category has subcategories' })
  async remove(@Param('id') id: string): Promise<Category> {
    return this.categoryService.remove(id);
  }

  @Delete(':id/with-descendants')
  @ApiOperation({ 
    summary: 'Delete a category and all its descendants (USE WITH CAUTION)',
    description: 'This will permanently delete the category and all its subcategories at all levels'
  })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category and descendants deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async removeWithDescendants(@Param('id') id: string): Promise<{ deletedCount: number; deletedCategories: string[] }> {
    return this.categoryService.removeWithDescendants(id);
  }
}