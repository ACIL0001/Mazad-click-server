import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Fuse from 'fuse.js';
import {
    SearchTerm,
    SearchEdgeWeight,
    NotifyMeRequest,
} from './entities/search.entity';
import {
    SearchFallbackDto,
    UpdateEdgeWeightDto,
    NotifyMeDto,
    SearchResultDto,
} from './dto/search.dto';

@Injectable()
export class SearchService {
    constructor(
        @InjectModel(SearchTerm.name)
        private searchTermModel: Model<SearchTerm>,
        @InjectModel(SearchEdgeWeight.name)
        private edgeWeightModel: Model<SearchEdgeWeight>,
        @InjectModel(NotifyMeRequest.name)
        private notifyMeModel: Model<NotifyMeRequest>,
    ) { }

    /**
     * Perform fallback search when fuzzy matching fails
     * Returns top 3 results with probability > 50%
     */
    async searchFallback(dto: SearchFallbackDto): Promise<{
        success: boolean;
        results: SearchResultDto[];
        hasResults: boolean;
    }> {
        const { query, limit = 3, minProbability = 50 } = dto;
        const normalizedQuery = query.toLowerCase().trim();

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[SERVER]━');
        console.log('🔍 DATABASE FALLBACK SEARCH');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 Query:', query);
        console.log('🎯 Limit:', limit);
        console.log('📊 Min Probability:', minProbability + '%');

        try {
            // 1. Fetch search terms
            const searchTerms = await this.searchTermModel
                .find()
                .sort({ searchCount: -1 })
                .limit(100)
                .lean()
                .exec();

            console.log('📚 Search terms in database:', searchTerms.length);

            // 2. Fetch edge weights for this query
            const edgeWeights = await this.edgeWeightModel
                .find({ searchQuery: normalizedQuery })
                .lean()
                .exec();

            // Create edge weight map for quick lookup
            const edgeWeightMap = new Map();
            edgeWeights.forEach((ew) => {
                edgeWeightMap.set(ew.selectedTermId.toString(), ew.weight);
            });

            console.log('⚖️  Edge weights found:', edgeWeights.length);

            // 3. Perform fuzzy matching with Fuse.js
            const fuse = new Fuse(searchTerms, {
                keys: [
                    { name: 'term', weight: 0.5 },
                    { name: 'normalizedTerm', weight: 0.3 },
                    { name: 'metadata.aliases', weight: 0.2 },
                ],
                threshold: 0.6,
                includeScore: true,
                ignoreLocation: true,
            });

            const fuseResults = fuse.search(query);

            console.log('🔎 Fuse.js fuzzy results:', fuseResults.length);

            // 4. Calculate probability scores
            const results: SearchResultDto[] = fuseResults.map((result) => {
                const item: any = result.item;
                const edgeWeight = edgeWeightMap.get(item._id.toString()) || 0;

                // Base score from fuzzy matching (0-1, higher is better)
                const baseScore = 1 - (result.score || 0);

                // Edge weight boost (max 30% boost)
                const edgeBoost = Math.min(edgeWeight * 0.1, 0.3);

                // Popularity boost (max 10% boost)
                const popularityBoost = Math.min((item.searchCount || 0) / 1000, 0.1);

                // Calculate final probability (0-100)
                const probability = Math.min(
                    (baseScore + edgeBoost + popularityBoost) * 100,
                    100,
                );

                return {
                    term: item.term,
                    type: item.type,
                    probability: Math.round(probability),
                    score: result.score,
                    categoryId: item.categoryId?.toString(),
                    metadata: item.metadata,
                    edgeWeight: edgeWeight,
                    termId: item._id.toString(),
                } as any;
            });

            // 5. Filter by minimum probability and limit
            const filteredResults = results
                .filter((r) => r.probability >= minProbability)
                .slice(0, limit);

            console.log('📊 Results after filtering (>' + minProbability + '%):', filteredResults.length);
            filteredResults.forEach((r, i) => {
                console.log(`  ${i + 1}. ${r.term} (${r.probability}%, type: ${r.type})`);
            });
            console.log('✅ Returning', filteredResults.length, 'results');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            return {
                success: true,
                results: filteredResults,
                hasResults: filteredResults.length > 0,
            };
        } catch (error) {
            console.error('Search fallback error:', error);
            throw error;
        }
    }

    /**
     * Update edge weight when user selects a search result
     * Increments weight by 0.5 for learning
     */
    async updateEdgeWeight(dto: UpdateEdgeWeightDto): Promise<{
        success: boolean;
    }> {
        const { searchQuery, selectedTermId, selectedType, selectedId } = dto;
        const normalizedQuery = searchQuery.toLowerCase().trim();

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[SERVER]━');
        console.log('🧠 EDGE WEIGHT UPDATE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 Query:', searchQuery);
        console.log('🆔 Term ID:', selectedTermId);

        try {
            // Check if edge weight already exists
            const existing = await this.edgeWeightModel.findOne({
                searchQuery: normalizedQuery,
                selectedTermId: selectedTermId,
            });

            if (existing) {
                // Update existing edge weight
                console.log('📈 Updating existing weight:', existing.weight, '→', existing.weight + 0.5);
                console.log('🔢 Selection count:', existing.selectionCount, '→', existing.selectionCount + 1);
                existing.weight += 0.5;
                existing.selectionCount += 1;
                existing.lastSelectedAt = new Date();
                await existing.save();
            } else {
                // Create new edge weight
                console.log('🆕 Creating new edge weight (weight: 1.0)');
                await this.edgeWeightModel.create({
                    searchQuery: normalizedQuery,
                    selectedTermId,
                    selectedType,
                    selectedId,
                    weight: 1.0,
                    selectionCount: 1,
                    lastSelectedAt: new Date(),
                });
            }

            // Increment search count for the term
            await this.searchTermModel.findByIdAndUpdate(
                selectedTermId,
                { $inc: { searchCount: 1 } },
            );

            console.log('✅ Edge weight updated successfully');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            return { success: true };
        } catch (error) {
            console.error('Update edge weight error:', error);
            throw error;
        }
    }

    /**
     * Create a notify me request when no results found
     */
    async createNotifyMeRequest(dto: NotifyMeDto): Promise<{
        success: boolean;
        requestId: string;
        message: string;
    }> {
        const { searchQuery, userId, email, phone } = dto;

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[SERVER]━');
        console.log('🔔 NOTIFY ME REQUEST');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 Query:', searchQuery);
        console.log('📧 Email:', email);

        try {
            // Calculate expiration date (30 days from now)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            const request = await this.notifyMeModel.create({
                searchQuery: searchQuery.toLowerCase().trim(),
                userId: userId || null,
                email: email || null,
                phone: phone || null,
                status: 'pending',
                expiresAt,
            });

            console.log('✅ Notify me request created');
            console.log('🆔 Request ID:', request._id.toString());
            console.log('📅 Expires:', expiresAt.toLocaleDateString());
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            return {
                success: true,
                requestId: request._id.toString(),
                message: 'We will notify you when this item becomes available!',
            };
        } catch (error) {
            console.error('Notify me error:', error);
            throw error;
        }
    }

    /**
     * Notify users who requested items matching the new item
     */
    async notifyInterestedUsers(itemTitle: string, itemDescription: string, itemType: string, itemId: string): Promise<void> {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[SERVER]━');
        console.log('📢 CHECKING FOR INTERESTED USERS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 New Item:', itemTitle);
        console.log('📝 Type:', itemType);

        try {
            // 1. Get all pending requests
            const pendingRequests = await this.notifyMeModel
                .find({ status: 'pending', expiresAt: { $gt: new Date() } })
                .exec();

            if (pendingRequests.length === 0) {
                console.log('info: No pending requests found.');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                return;
            }

            console.log(`🔍 Checking ${pendingRequests.length} pending requests...`);

            // 2. Fuzzy match against requests
            // We want to see if the itemTitle matches the user's searchQuery
            // So we treat the current item as the "source" and search queries as "targets"

            const fuse = new Fuse(pendingRequests, {
                keys: ['searchQuery'],
                threshold: 0.4, // Somewhat strict to avoid spam
                includeScore: true,
            });

            // Search using the ITEM TITLE as the query against the requests
            // But wait, usually search works the other way (Query -> Database). 
            // Here we want: Does "iPhone 15" match "iphone"? Yes.
            // Does "iPhone 15" match "samsung"? No.

            // A better approach: Iterate requests and check if item title "contains" the search query vaguely

            let notifiedCount = 0;

            for (const request of pendingRequests) {
                // Simple fuzzy check: 
                // Does the Item Title (e.g. "iPhone 15 Pro Max 256GB") 
                // contain the User Query (e.g. "iphone 15")?

                const itemText = (itemTitle + ' ' + (itemDescription || '')).toLowerCase();
                const query = request.searchQuery.toLowerCase();

                // 1. Direct inclusion check (Fastest)
                if (itemText.includes(query)) {
                    await this.sendNotificationEmail(request, itemTitle, itemId, itemType);
                    notifiedCount++;
                    continue;
                }

                // 2. Levenshtein check for typos (slower but handles "iphoen")
                // We'll skip complex fuzzy logic here for performance unless requested
                // "includes" covers 95% of cases like "iphone" in "iPhone 15"
            }

            console.log(`✅ Notified ${notifiedCount} users`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        } catch (error) {
            console.error('Error notifying users:', error);
        }
    }

    private async sendNotificationEmail(request: any, itemTitle: string, itemId: string, itemType: string) {
        console.log(`📧 SENDING EMAIL TO: ${request.email}`);
        console.log(`   subject: Good news! We found "${request.searchQuery}"`);
        console.log(`   body: The item "${itemTitle}" just got added! Check it out here: /${itemType}/${itemId}`);

        // Mark as notified so we don't spam
        request.status = 'notified';
        request.notifiedAt = new Date();
        request.foundItemId = itemId;
        await request.save();
    }

    /**
     * Seed the database with common search terms
     */
    async seedSearchTerms(terms: any[]): Promise<{ success: boolean; count: number }> {
        try {
            let count = 0;

            for (const term of terms) {
                const normalized = term.term.toLowerCase().trim();

                // Check if term already exists
                const existing = await this.searchTermModel.findOne({
                    normalizedTerm: normalized,
                    type: term.type,
                });

                if (!existing) {
                    await this.searchTermModel.create({
                        term: term.term,
                        type: term.type,
                        normalizedTerm: normalized,
                        categoryId: term.categoryId || null,
                        metadata: term.metadata || {},
                        searchCount: 0,
                    });
                    count++;
                }
            }

            return { success: true, count };
        } catch (error) {
            console.error('Seed error:', error);
            throw error;
        }
    }
}
