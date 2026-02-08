import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SearchService } from '../modules/search/search.service';
import { commonSearchTerms } from '../modules/search/data/search-terms.data';

async function bootstrap() {
    console.log('🌱 Starting search terms seeding...');

    const app = await NestFactory.createApplicationContext(AppModule);
    const searchService = app.get(SearchService);

    try {
        const result = await searchService.seedSearchTerms(commonSearchTerms);
        console.log(`✅ Successfully seeded ${result.count} search terms`);
        console.log(`📊 Total terms in seed file: ${commonSearchTerms.length}`);
    } catch (error) {
        console.error('❌ Error seeding search terms:', error);
        process.exit(1);
    }

    await app.close();
    console.log('🎉 Seeding completed!');
    process.exit(0);
}

bootstrap();
