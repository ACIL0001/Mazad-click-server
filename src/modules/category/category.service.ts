// category.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schema/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MoveCategoryDto } from './dto/move-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const { parent, ...categoryData } = createCategoryDto;
    
    let level = 0;
    let path: string[] = [];
    let fullPath = categoryData.name;
    
    // If parent is specified, validate it and build hierarchy info
    if (parent) {
      const parentCategory = await this.categoryModel.findById(parent).exec();
      if (!parentCategory) {
        throw new NotFoundException(`Parent category with ID ${parent} not found`);
      }
      
      level = parentCategory.level + 1;
      path = [...parentCategory.path, parent];
      fullPath = parentCategory.fullPath ? `${parentCategory.fullPath} > ${categoryData.name}` : categoryData.name;
    }

    const createdCategory = new this.categoryModel({
      ...categoryData,
      parent: parent || null,
      level,
      path,
      fullPath,
    });

    const savedCategory = await createdCategory.save();

    // Add this category to parent's children array
    if (parent) {
      await this.categoryModel.findByIdAndUpdate(
        parent,
        { $addToSet: { children: savedCategory._id } },
      ).exec();
    }

    return savedCategory;
  }

  async findAll(): Promise<Category[]> {
    return this.categoryModel
      .find()
      .populate('thumb')
      .populate('parent', 'name')
      .populate('children', 'name')
      .sort({ fullPath: 1 })
      .exec();
  }

  async findRootCategories(): Promise<Category[]> {
    return this.categoryModel
      .find({ parent: null })
      .populate('thumb')
      .populate('children', 'name')
      .sort({ name: 1 })
      .exec();
  }

  async findByParent(parentId: string): Promise<Category[]> {
    if (parentId) {
      // Validate parent exists
      const parentExists = await this.categoryModel.findById(parentId).exec();
      if (!parentExists) {
        throw new NotFoundException(`Parent category with ID ${parentId} not found`);
      }
    }

    return this.categoryModel
      .find({ parent: parentId || null })
      .populate('thumb')
      .populate('children', 'name')
      .sort({ name: 1 })
      .exec();
  }

  async findCategoryTree(): Promise<any[]> {
    const rootCategories = await this.categoryModel
      .find({ parent: null })
      .populate('thumb')
      .sort({ name: 1 })
      .lean()
      .exec();

    return Promise.all(rootCategories.map(category => this.buildCategoryTree(category)));
  }

  private async buildCategoryTree(category: any): Promise<any> {
    const children = await this.categoryModel
      .find({ parent: category._id })
      .populate('thumb')
      .sort({ name: 1 })
      .lean()
      .exec();

    const childrenWithSubcategories = await Promise.all(
      children.map(child => this.buildCategoryTree(child))
    );

    return {
      ...category,
      children: childrenWithSubcategories,
    };
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryModel
      .findById(id)
      .populate('thumb')
      .populate('parent', 'name fullPath')
      .populate('children', 'name')
      .exec();

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async findWithAncestors(id: string): Promise<{ category: Category; ancestors: Category[] }> {
    const category = await this.findOne(id);
    
    let ancestors: Category[] = [];
    if (category.path && category.path.length > 0) {
      ancestors = await this.categoryModel
        .find({ _id: { $in: category.path } })
        .populate('thumb')
        .exec();
      
      // Sort ancestors by their position in the path
      ancestors.sort((a, b) => {
        const aIndex = category.path.findIndex(pathId => pathId.toString() === a._id.toString());
        const bIndex = category.path.findIndex(pathId => pathId.toString() === b._id.toString());
        return aIndex - bIndex;
      });
    }

    return { category, ancestors };
  }

  async findWithDescendants(id: string): Promise<{ category: Category; descendants: Category[] }> {
    const category = await this.findOne(id);
    const descendants = await this.getAllDescendants(id);

    return { category, descendants };
  }

  private async getAllDescendants(categoryId: string): Promise<Category[]> {
    const directChildren = await this.categoryModel
      .find({ parent: categoryId })
      .populate('thumb')
      .exec();

    let allDescendants: Category[] = [...directChildren];

    for (const child of directChildren) {
      const childDescendants = await this.getAllDescendants(child._id);
      allDescendants.push(...childDescendants);
    }

    return allDescendants;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const existingCategory = await this.categoryModel.findById(id).exec();
    if (!existingCategory) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // If updating the name, we need to update fullPath for this category and all descendants
    if (updateCategoryDto.name && updateCategoryDto.name !== existingCategory.name) {
      await this.updateFullPaths(id, updateCategoryDto.name);
    }

    const updatedCategory = await this.categoryModel
      .findByIdAndUpdate(id, updateCategoryDto, { new: true })
      .populate('thumb')
      .populate('parent', 'name')
      .populate('children', 'name')
      .exec();

    if (!updatedCategory) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return updatedCategory;
  }

  async moveCategory(id: string, moveCategoryDto: MoveCategoryDto): Promise<Category> {
    const { newParent } = moveCategoryDto;
    const category = await this.categoryModel.findById(id).exec();
    
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Prevent circular references
    if (newParent) {
      const isDescendant = await this.isDescendantOf(newParent, id);
      if (isDescendant) {
        throw new BadRequestException('Cannot move category to one of its descendants');
      }

      // Validate new parent exists
      const newParentCategory = await this.categoryModel.findById(newParent).exec();
      if (!newParentCategory) {
        throw new NotFoundException(`New parent category with ID ${newParent} not found`);
      }
    }

    // Remove from old parent's children
    if (category.parent) {
      await this.categoryModel.findByIdAndUpdate(
        category.parent,
        { $pull: { children: id } },
      ).exec();
    }

    // Add to new parent's children
    if (newParent) {
      await this.categoryModel.findByIdAndUpdate(
        newParent,
        { $addToSet: { children: id } },
      ).exec();
    }

    // Update hierarchy information for moved category and all its descendants
    await this.updateHierarchyInfo(id, newParent);

    return this.findOne(id);
  }

  private async isDescendantOf(categoryId: string, potentialAncestorId: string): Promise<boolean> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) return false;

    return category.path.some(pathId => pathId.toString() === potentialAncestorId);
  }

  private async updateHierarchyInfo(categoryId: string, newParentId: string | null): Promise<void> {
    let level = 0;
    let path: string[] = [];
    let parentFullPath = '';

    if (newParentId) {
      const newParent = await this.categoryModel.findById(newParentId).exec();
      if (newParent) {
        level = newParent.level + 1;
        path = [...newParent.path, newParentId];
        parentFullPath = newParent.fullPath;
      }
    }

    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) return;

    const newFullPath = parentFullPath ? `${parentFullPath} > ${category.name}` : category.name;

    // Update the category itself
    await this.categoryModel.findByIdAndUpdate(categoryId, {
      parent: newParentId,
      level,
      path,
      fullPath: newFullPath,
    }).exec();

    // Update all descendants
    const descendants = await this.getAllDescendants(categoryId);
    for (const descendant of descendants) {
      await this.updateSingleCategoryHierarchy(descendant._id);
    }
  }

  private async updateSingleCategoryHierarchy(categoryId: string): Promise<void> {
    const category = await this.categoryModel.findById(categoryId).populate('parent').exec();
    if (!category) return;

    let level = 0;
    let path: string[] = [];
    let fullPath = category.name;

    if (category.parent) {
      const parent = category.parent as any;
      level = parent.level + 1;
      path = [...parent.path, parent._id];
      fullPath = parent.fullPath ? `${parent.fullPath} > ${category.name}` : category.name;
    }

    await this.categoryModel.findByIdAndUpdate(categoryId, {
      level,
      path,
      fullPath,
    }).exec();
  }

  private async updateFullPaths(categoryId: string, newName: string): Promise<void> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) return;

    // Calculate new full path
    let newFullPath = newName;
    if (category.path && category.path.length > 0) {
      const ancestors = await this.categoryModel
        .find({ _id: { $in: category.path } })
        .exec();
      
      const ancestorNames = category.path.map(pathId => {
        const ancestor = ancestors.find(a => a._id.toString() === pathId.toString());
        return ancestor ? ancestor.name : '';
      }).filter(name => name);
      
      newFullPath = ancestorNames.length > 0 ? `${ancestorNames.join(' > ')} > ${newName}` : newName;
    }

    // Update this category's full path
    await this.categoryModel.findByIdAndUpdate(categoryId, {
      fullPath: newFullPath,
    }).exec();

    // Update all descendants' full paths
    const descendants = await this.getAllDescendants(categoryId);
    for (const descendant of descendants) {
      await this.updateSingleCategoryHierarchy(descendant._id);
    }
  }

  async remove(id: string): Promise<Category> {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Check if category has children
    const hasChildren = await this.categoryModel.countDocuments({ parent: id }).exec();
    if (hasChildren > 0) {
      throw new BadRequestException('Cannot delete category with subcategories. Please delete or move subcategories first.');
    }

    // Remove from parent's children array
    if (category.parent) {
      await this.categoryModel.findByIdAndUpdate(
        category.parent,
        { $pull: { children: id } },
      ).exec();
    }

    const deletedCategory = await this.categoryModel.findByIdAndDelete(id).exec();
    return deletedCategory!;
  }

  async removeWithDescendants(id: string): Promise<{ deletedCount: number; deletedCategories: string[] }> {
    const category = await this.findOne(id);
    const descendants = await this.getAllDescendants(id);
    const allIds = [id, ...descendants.map(d => d._id)];

    // Remove from parent's children array
    if (category.parent) {
      await this.categoryModel.findByIdAndUpdate(
        category.parent,
        { $pull: { children: id } },
      ).exec();
    }

    // Delete all categories
    const result = await this.categoryModel.deleteMany({ _id: { $in: allIds } }).exec();

    return {
      deletedCount: result.deletedCount || 0,
      deletedCategories: allIds,
    };
  }
}