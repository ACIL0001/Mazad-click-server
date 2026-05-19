import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { RoleCode } from 'src/modules/apikey/entity/appType.entity';

export enum ApiKeyStatus {
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
  EXPIRED = 'EXPIRED',
}

@Schema({ timestamps: true })
export class ApiKey {
  @Prop({ type: String, unique: true, required: true })
  key: string;

  @Prop({ type: String, enum: Object.values(RoleCode), required: true })
  type: string;

  @Prop({ type: Boolean, default: true })
  actif: boolean;

  @Prop({
    type: String,
    enum: Object.values(ApiKeyStatus),
    default: ApiKeyStatus.ACTIVE,
  })
  status: ApiKeyStatus;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Number, required: true, default: 1 })
  version: number;
}

export type ApiKeyDocument = HydratedDocument<ApiKey>;
export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
