import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { Attachment } from '../../attachment/schema/attachment.schema';
import { Category } from '../../category/schema/category.schema';

export enum CATEGORY_TYPE {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
}

@Schema({ timestamps: true })
export class SubCategory {
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, type: S.Types.ObjectId, ref: Category.name })
  category: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ type: S.Types.ObjectId, ref: Attachment.name })
  thumb: string;

  @Prop({ type: [String], default: [] })
  attributes: string[];
}

export type SubCategoryDocument = HydratedDocument<SubCategory>;
export const SubCategorySchema = SchemaFactory.createForClass(SubCategory);
