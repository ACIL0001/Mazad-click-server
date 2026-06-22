import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AnalyticsHeatmapDocument = HydratedDocument<AnalyticsHeatmap>;

@Schema({ timestamps: true, collection: 'analytics_heatmaps' })
export class AnalyticsHeatmap {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  urlPath: string;

  @Prop({ required: true })
  sessionId: string;

  @Prop({
    required: true,
    enum: ['click', 'rage_click', 'dead_click', 'scroll'],
    index: true,
  })
  interactionType: string;

  @Prop({
    type: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    required: true,
    _id: false,
  })
  position: { x: number; y: number };

  @Prop({ default: '' })
  elementSelector: string;

  @Prop({ type: Number })
  viewportWidth: number;

  @Prop({ type: Number })
  viewportHeight: number;

  @Prop({ type: Number, min: 0, max: 100 })
  scrollDepth: number;
}

export const AnalyticsHeatmapSchema = SchemaFactory.createForClass(AnalyticsHeatmap);

// TTL: 30 days for raw heatmap data (2,592,000 seconds)
AnalyticsHeatmapSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
AnalyticsHeatmapSchema.index({ urlPath: 1, interactionType: 1, createdAt: 1 });
