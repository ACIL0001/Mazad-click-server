import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true, collection: 'search_terms' })
export class SearchTerm extends Document {
    @Prop({ required: true })
    term: string;

    @Prop({ required: true, enum: ['product', 'category', 'service', 'brand'] })
    type: string;

    @Prop({ required: true, index: true })
    normalizedTerm: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', default: null })
    categoryId: MongooseSchema.Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
    metadata: {
        brand?: string;
        category?: string;
        aliases?: string[];
        commonSearches?: string[];
    };

    @Prop({ default: 0, index: true })
    searchCount: number;
}

export const SearchTermSchema = SchemaFactory.createForClass(SearchTerm);

// Create compound index for unique normalized_term + type
SearchTermSchema.index({ normalizedTerm: 1, type: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'search_edge_weights' })
export class SearchEdgeWeight extends Document {
    @Prop({ required: true, index: true })
    searchQuery: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SearchTerm', required: true })
    selectedTermId: MongooseSchema.Types.ObjectId;

    @Prop({ required: true, enum: ['category', 'auction', 'tender', 'directSale'] })
    selectedType: string;

    @Prop({ required: true })
    selectedId: string;

    @Prop({ default: 1.0, index: true })
    weight: number;

    @Prop({ default: () => new Date() })
    lastSelectedAt: Date;

    @Prop({ default: 1 })
    selectionCount: number;
}

export const SearchEdgeWeightSchema = SchemaFactory.createForClass(SearchEdgeWeight);

// Create compound index for unique searchQuery + selectedTermId
SearchEdgeWeightSchema.index({ searchQuery: 1, selectedTermId: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'notify_me_requests' })
export class NotifyMeRequest extends Document {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
    userId: MongooseSchema.Types.ObjectId;

    @Prop({ required: true, index: true })
    searchQuery: string;

    @Prop({ default: null })
    email: string;

    @Prop({ default: null })
    phone: string;

    @Prop({ default: 'pending', enum: ['pending', 'resolved', 'expired'], index: true })
    status: string;

    @Prop({
        default: () => {
            const date = new Date();
            date.setDate(date.getDate() + 30);
            return date;
        }
    })
    expiresAt: Date;

    @Prop({ default: null })
    resolvedAt: Date;
}

export const NotifyMeRequestSchema = SchemaFactory.createForClass(NotifyMeRequest);
