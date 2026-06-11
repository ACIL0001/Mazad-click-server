import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SearchService } from '../modules/search/search.service';
import { commonSearchTerms } from '../modules/search/data/search-terms.data';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const searchService = app.get(SearchService);

    try {
        const result = await searchService.seedSearchTerms(commonSearchTerms);
    } catch (error) {
        console.error('❌ Error seeding search terms:', error);
        process.exit(1);
    }

    await app.close();
    process.exit(0);
}

bootstrap();
