// src/category/schemas/category.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { Attachment } from '../../attachment/schema/attachment.schema';

export enum CATEGORY_TYPE {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
}

@Schema({ timestamps: true })
export class Category {
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: Object.values(CATEGORY_TYPE), default: 'PRODUCT' })
  type: string;

  @Prop({ type: S.Types.ObjectId, ref: Attachment.name })
  thumb: string;

  @Prop({ type: String }) 
  description: string;

  @Prop({ type: [String], default: [] })
  attributes: string[];

  // Parent category reference - null for root categories
  @Prop({ type: S.Types.ObjectId, ref: 'Category', default: null })
  parent: string | null;

  // Array of direct child categories
  @Prop({ type: [{ type: S.Types.ObjectId, ref: 'Category' }], default: [] })
  children: string[];

  // Computed field for hierarchy level (0 = root, 1 = first level, etc.)
  @Prop({ type: Number, default: 0 })
  level: number;

  // Path from root to current category (array of category IDs)
  @Prop({ type: [{ type: S.Types.ObjectId, ref: 'Category' }], default: [] })
  path: string[];

  // Full path names for easy display (e.g., "Electronics > Phones > Smartphones")
  @Prop({ type: String, default: '' })
  fullPath: string;
}

export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);