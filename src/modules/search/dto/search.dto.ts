import { IsString, IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';

export class SearchTermDto {
    @IsString()
    term: string;

    @IsEnum(['product', 'category', 'service', 'brand'])
    type: 'product' | 'category' | 'service' | 'brand';

    @IsString()
    normalizedTerm: string;

    @IsOptional()
    @IsString()
    categoryId?: string;

    @IsOptional()
    metadata?: {
        brand?: string;
        aliases?: string[];
        commonSearches?: string[];
        category?: string;
    };
}

export class SearchFallbackDto {
    @IsString()
    query: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    limit?: number = 3;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    minProbability?: number = 50;
}

export class UpdateEdgeWeightDto {
    @IsString()
    searchQuery: string;

    @IsString()
    selectedTermId: string;

    @IsEnum(['category', 'auction', 'tender', 'directSale'])
    selectedType: 'category' | 'auction' | 'tender' | 'directSale';

    @IsString()
    selectedId: string;
}

export class NotifyMeDto {
    @IsString()
    searchQuery: string;

    @IsOptional()
    @IsString()
    userId?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;
}

export class SearchResultDto {
    @IsString()
    term: string;

    @IsString()
    type: string;

    @IsNumber()
    probability: number;

    @IsNumber()
    score: number;

    @IsOptional()
    @IsString()
    categoryId?: string;

    @IsOptional()
    metadata?: any;

    @IsOptional()
    @IsNumber()
    edgeWeight?: number;
}
