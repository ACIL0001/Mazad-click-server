import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import {
    SearchTerm,
    SearchTermSchema,
    SearchEdgeWeight,
    SearchEdgeWeightSchema,
    NotifyMeRequest,
    NotifyMeRequestSchema,
} from './entities/search.entity';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: SearchTerm.name, schema: SearchTermSchema },
            { name: SearchEdgeWeight.name, schema: SearchEdgeWeightSchema },
            { name: NotifyMeRequest.name, schema: NotifyMeRequestSchema },
        ]),
    ],
    controllers: [SearchController],
    providers: [SearchService],
    exports: [SearchService],
})
export class SearchModule { }
