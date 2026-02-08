import { Controller, Post, Body, Get } from '@nestjs/common';
import { SearchService } from './search.service';
import {
    SearchFallbackDto,
    UpdateEdgeWeightDto,
    NotifyMeDto,
} from './dto/search.dto';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('search')
@Public()
export class SearchController {
    constructor(private readonly searchService: SearchService) { }

    /**
     * POST /search/fallback
     * Performs database fallback search when fuzzy matching fails
     */
    @Post('fallback')
    async searchFallback(@Body() dto: SearchFallbackDto) {
        return this.searchService.searchFallback(dto);
    }

    /**
     * POST /search/update-edge-weight
     * Updates edge weight when user selects a result (learning system)
     */
    @Post('update-edge-weight')
    async updateEdgeWeight(@Body() dto: UpdateEdgeWeightDto) {
        return this.searchService.updateEdgeWeight(dto);
    }

    /**
     * POST /search/notify-me
     * Creates a notification request for unavailable items
     */
    @Post('notify-me')
    async notifyMe(@Body() dto: NotifyMeDto) {
        return this.searchService.createNotifyMeRequest(dto);
    }

    /**
     * GET /search/health
     * Health check endpoint
     */
    @Get('health')
    async healthCheck() {
        return { status: 'ok', service: 'search' };
    }
}
