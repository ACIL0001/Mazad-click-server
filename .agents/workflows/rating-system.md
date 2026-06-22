---
description: Implement two-tier announcement rating system on the backend
---

# Rating System Workflow

## Overview
Two-tier rating system where reviews (1–5 stars) target Announcements, and a user's score
is derived from their announcements' average ratings. The existing like/dislike system
on User is preserved and continues to work independently.

**Eligibility Rule**: Only the verified winner/buyer can submit a review, and only after
a 1-hour window has passed since the transaction conclusion.

---

## Architecture Decision: Eligibility Gate

Based on the existing database architecture:

| Transaction Type | Winner Field | Eligibility Trigger |
|-----------------|-------------|---------------------|
| **Enchère (Auction)** | `Bid.winner` (set when `status → ACCEPTED`) | `Bid.winner === reviewer` |
| **Appel d'offre (Tender)** | `Tender.awardedTo` (set when `status → AWARDED`) | `Tender.awardedTo === reviewer` |
| **Vente Directe (DirectSale)** | `DirectSalePurchase.buyer` (when `status → CONFIRMED`) | `DirectSalePurchase.buyer === reviewer` |

The 1-hour delay is enforced using a `reviewAvailableAt` field that mirrors the existing
`Bid.feedbackAvailableAt` pattern already in the schema.

---

## Step 1 — Create the Announcement Review Schema (NEW collection)

File: `src/modules/review/announcement-review.schema.ts`

> Do NOT touch `review.schema.ts` — the like/dislike system stays as-is.

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, Document } from 'mongoose';

@Schema({ timestamps: true })
export class AnnouncementReview {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  reviewer: Types.ObjectId; // The winner/buyer

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  announcement: Types.ObjectId;

  // Mongoose dynamic ref: lets us .populate() across Bid/DirectSale/Tender
  @Prop({ type: String, enum: ['Bid', 'DirectSale', 'Tender'], required: true })
  announcementModel: 'Bid' | 'DirectSale' | 'Tender';

  // Denormalized for fast seller score queries (avoids cross-collection join)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  seller: Types.ObjectId;

  @Prop({ type: Number, min: 1, max: 5, required: true })
  stars: number;

  @Prop({ type: String, maxlength: 500 })
  comment?: string;
}

export type AnnouncementReviewDocument = AnnouncementReview & Document;
export const AnnouncementReviewSchema = SchemaFactory.createForClass(AnnouncementReview);

// Unique: one review per (reviewer, announcement)
AnnouncementReviewSchema.index({ reviewer: 1, announcement: 1 }, { unique: true });
AnnouncementReviewSchema.index({ announcement: 1 }); // fast announcement lookup
AnnouncementReviewSchema.index({ seller: 1 });       // fast user score calculation
```

---

## Step 2 — Add `reviewAvailableAt` to All Announcement Schemas

This mirrors the existing `Bid.feedbackAvailableAt` pattern already in the Bid schema.
Set to `Date.now() + 1 hour` at the moment of transaction completion.

### `src/modules/bid/schema/bid.schema.ts`
```typescript
// Already has feedbackAvailableAt — add:
@Prop({ type: Date })
reviewAvailableAt?: Date; // Set when bid.winner is assigned
```

### `src/modules/tender/schema/tender.schema.ts`
```typescript
@Prop({ type: Date })
reviewAvailableAt?: Date; // Set when tender.awardedTo is assigned
```

### `src/modules/direct-sale/schema/direct-sale.schema.ts`
```typescript
// Add to DirectSalePurchase (NOT DirectSale):
@Prop({ type: Date })
reviewAvailableAt?: Date; // Set when purchase.status → CONFIRMED
```

---

## Step 3 — Add Cached Rating Fields to Announcement Schemas

> **Why cached fields?** Calculating AVG on every page load causes full collection scans.
> Write-time cache invalidation means reads are always O(1) single-field lookups.

Add to `Bid`, `DirectSale`, and `Tender`:

```typescript
@Prop({ type: Number, default: 0 }) ratingSum: number;
@Prop({ type: Number, default: 0 }) ratingCount: number;
@Prop({ type: Number, default: 0 }) ratingAvg: number;    // sum/count
@Prop({ type: Number, default: 0 }) ratingPercent: number; // (avg/5)*100
```

---

## Step 4 — Add `score` to User Schema

File: `src/modules/user/schema/user.schema.ts`

```typescript
// Add alongside existing `rate` (1-10) — does NOT replace it
@Prop({ type: Number, default: 0, min: 0, max: 100 })
score: number; // Average of all announcement ratingPercents (0-100)
```

---

## Step 5 — Set `reviewAvailableAt` at Transaction Completion

Hook into existing transaction-close logic.

### For Auctions — in `bid.service.ts` (inside the `checkBids` loop, around line 306)
```typescript
// When bid.winner is assigned:
await this.bidModel.findByIdAndUpdate(getAllBids[index]._id, {
  status: BID_STATUS.ON_AUCTION,
  winner: max.user,
  reviewAvailableAt: new Date(Date.now() + 60 * 60 * 1000), // +1 hour
});
```

### For Tenders — in `tender.service.ts` (where awardedTo is set)
```typescript
await this.tenderModel.findByIdAndUpdate(tenderId, {
  status: TENDER_STATUS.AWARDED,
  awardedTo: winnerId,
  reviewAvailableAt: new Date(Date.now() + 60 * 60 * 1000),
});
```

### For Direct Sales — in `direct-sale.service.ts` (where status → CONFIRMED)
```typescript
await this.directSalePurchaseModel.findByIdAndUpdate(purchaseId, {
  status: PURCHASE_STATUS.CONFIRMED,
  reviewAvailableAt: new Date(Date.now() + 60 * 60 * 1000),
});
```

---

## Step 6 — Rewrite the Announcement Review Service

File: `src/modules/review/announcement-review.service.ts`

```typescript
@Injectable()
export class AnnouncementReviewService {
  constructor(
    @InjectModel(AnnouncementReview.name) private reviewModel: Model<AnnouncementReviewDocument>,
    @InjectModel(Bid.name)              private bidModel: Model<BidDocument>,
    @InjectModel(DirectSale.name)       private directSaleModel: Model<any>,
    @InjectModel(DirectSalePurchase.name) private purchaseModel: Model<any>,
    @InjectModel(Tender.name)           private tenderModel: Model<TenderDocument>,
    @InjectModel(User.name)             private userModel: Model<UserDocument>,
  ) {}

  async createOrUpdateReview(
    reviewerId: string,
    announcementId: string,
    announcementModel: 'Bid' | 'DirectSale' | 'Tender',
    stars: number,
    comment?: string,
  ) {
    if (!Number.isInteger(stars) || stars < 1 || stars > 5)
      throw new BadRequestException('Les étoiles doivent être un entier entre 1 et 5');

    // 1. Verify the reviewer is eligible (winner/buyer) and the 1-hour window has passed
    await this.checkEligibility(reviewerId, announcementId, announcementModel);

    // 2. Resolve seller
    const seller = await this.getSellerFromAnnouncement(announcementId, announcementModel);

    // 3. Upsert the review
    await this.reviewModel.findOneAndUpdate(
      { reviewer: reviewerId, announcement: announcementId },
      { reviewer: reviewerId, announcement: announcementId, announcementModel, seller, stars, comment },
      { upsert: true, new: true },
    );

    // 4. Cascade update caches
    await this.recalculateAnnouncementRating(announcementId, announcementModel);
    await this.recalculateUserScore(seller.toString());
  }

  private async checkEligibility(
    reviewerId: string,
    announcementId: string,
    announcementModel: 'Bid' | 'DirectSale' | 'Tender',
  ) {
    const now = new Date();

    if (announcementModel === 'Bid') {
      const bid = await this.bidModel.findById(announcementId)
        .select('winner reviewAvailableAt status').lean();
      if (!bid) throw new NotFoundException('Enchère introuvable');
      if (!bid.winner || bid.winner.toString() !== reviewerId)
        throw new ForbiddenException('Seul le gagnant de l\'enchère peut laisser un avis');
      if (!bid.reviewAvailableAt || bid.reviewAvailableAt > now)
        throw new ForbiddenException('L\'avis sera disponible 1 heure après la fin de l\'enchère');

    } else if (announcementModel === 'Tender') {
      const tender = await this.tenderModel.findById(announcementId)
        .select('awardedTo reviewAvailableAt status').lean();
      if (!tender) throw new NotFoundException('Appel d\'offre introuvable');
      if (!tender.awardedTo || tender.awardedTo.toString() !== reviewerId)
        throw new ForbiddenException('Seul l\'adjudicataire peut laisser un avis');
      if (!tender.reviewAvailableAt || tender.reviewAvailableAt > now)
        throw new ForbiddenException('L\'avis sera disponible 1 heure après l\'attribution');

    } else { // DirectSale
      const purchase = await this.purchaseModel.findOne({
        directSale: announcementId,
        buyer: reviewerId,
        status: { $in: ['CONFIRMED', 'COMPLETED'] },
      }).select('reviewAvailableAt').lean();
      if (!purchase)
        throw new ForbiddenException('Vous devez confirmer l\'achat avant de laisser un avis');
      if (!purchase.reviewAvailableAt || purchase.reviewAvailableAt > now)
        throw new ForbiddenException('L\'avis sera disponible 1 heure après la confirmation de l\'achat');
    }
  }

  private async getSellerFromAnnouncement(id: string, model: string): Promise<Types.ObjectId> {
    const map = { Bid: this.bidModel, DirectSale: this.directSaleModel, Tender: this.tenderModel };
    const doc = await map[model].findById(id).select('owner').lean();
    if (!doc) throw new NotFoundException('Annonce introuvable');
    return doc.owner;
  }

  private async recalculateAnnouncementRating(id: string, model: string) {
    const [agg] = await this.reviewModel.aggregate([
      { $match: { announcement: new Types.ObjectId(id) } },
      { $group: { _id: null, avg: { $avg: '$stars' }, count: { $sum: 1 }, sum: { $sum: '$stars' } } },
    ]);
    const avg     = agg ? parseFloat(agg.avg.toFixed(2)) : 0;
    const count   = agg?.count ?? 0;
    const sum     = agg?.sum   ?? 0;
    const percent = parseFloat(((avg / 5) * 100).toFixed(2));
    const map = { Bid: this.bidModel, DirectSale: this.directSaleModel, Tender: this.tenderModel };
    await map[model].findByIdAndUpdate(id, { ratingAvg: avg, ratingCount: count, ratingSum: sum, ratingPercent: percent });
  }

  private async recalculateUserScore(sellerId: string) {
    const [bids, sales, tenders] = await Promise.all([
      this.bidModel.find({ owner: sellerId }).select('ratingPercent').lean(),
      this.directSaleModel.find({ owner: sellerId }).select('ratingPercent').lean(),
      this.tenderModel.find({ owner: sellerId }).select('ratingPercent').lean(),
    ]);
    const all   = [...bids, ...sales, ...tenders].map(d => d.ratingPercent ?? 0);
    const score = all.length
      ? parseFloat((all.reduce((a, b) => a + b, 0) / all.length).toFixed(2))
      : 0;
    await this.userModel.findByIdAndUpdate(sellerId, { score });
  }

  async getAnnouncementReviews(announcementId: string) {
    return this.reviewModel
      .find({ announcement: announcementId })
      .populate('reviewer', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getUserScore(userId: string) {
    const user = await this.userModel.findById(userId).select('score rate').lean();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  // Check if a user CAN leave a review (used by frontend to decide whether to show popup)
  async canReview(
    reviewerId: string,
    announcementId: string,
    announcementModel: 'Bid' | 'DirectSale' | 'Tender',
  ): Promise<{ eligible: boolean; availableAt?: Date; alreadyReviewed?: boolean }> {
    // Check if already reviewed
    const existing = await this.reviewModel.exists({ reviewer: reviewerId, announcement: announcementId });
    if (existing) return { eligible: false, alreadyReviewed: true };

    try {
      await this.checkEligibility(reviewerId, announcementId, announcementModel);
      return { eligible: true };
    } catch (e) {
      if (e instanceof ForbiddenException) return { eligible: false };
      throw e;
    }
  }
}
```

---

## Step 7 — Create the Announcement Review Controller

File: `src/modules/review/announcement-review.controller.ts`

```typescript
@Controller('announcement-review')
export class AnnouncementReviewController {
  constructor(private readonly service: AnnouncementReviewService) {}

  // POST /announcement-review/:model/:announcementId
  @Post(':model/:announcementId')
  @UseGuards(AuthGuard)
  create(
    @Request() req: ProtectedRequest,
    @Param('model') model: 'Bid' | 'DirectSale' | 'Tender',
    @Param('announcementId') announcementId: string,
    @Body('stars') stars: number,
    @Body('comment') comment?: string,
  ) {
    return this.service.createOrUpdateReview(
      req.session.user._id.toString(), announcementId, model, Number(stars), comment,
    );
  }

  // GET /announcement-review/:announcementId — public
  @Get(':announcementId')
  getReviews(@Param('announcementId') announcementId: string) {
    return this.service.getAnnouncementReviews(announcementId);
  }

  // GET /announcement-review/user/:userId/score — public
  @Get('user/:userId/score')
  getUserScore(@Param('userId') userId: string) {
    return this.service.getUserScore(userId);
  }

  // GET /announcement-review/can-review/:model/:announcementId — used by frontend popup
  @Get('can-review/:model/:announcementId')
  @UseGuards(AuthGuard)
  canReview(
    @Request() req: ProtectedRequest,
    @Param('model') model: 'Bid' | 'DirectSale' | 'Tender',
    @Param('announcementId') announcementId: string,
  ) {
    return this.service.canReview(
      req.session.user._id.toString(), announcementId, model,
    );
  }
}
```

---

## Step 8 — Update the Review Module

```typescript
@Module({
  imports: [
    MongooseModule.forFeature([
      // Keep existing:
      { name: Review.name,              schema: ReviewSchema },
      { name: User.name,                schema: UserSchema },
      // New:
      { name: AnnouncementReview.name,  schema: AnnouncementReviewSchema },
      { name: Bid.name,                 schema: BidSchema },
      { name: DirectSale.name,          schema: DirectSaleSchema },
      { name: DirectSalePurchase.name,  schema: DirectSalePurchaseSchema },
      { name: Tender.name,              schema: TenderSchema },
    ]),
  ],
  controllers: [ReviewController, AnnouncementReviewController],
  providers:   [ReviewService, AnnouncementReviewService],
  exports:     [ReviewService, AnnouncementReviewService],
})
export class ReviewModule {}
```

---

## Step 9 — Run the Backfill Migration

```bash
# From Mazad-click-server/
npx ts-node -r tsconfig-paths/register src/scripts/backfill-ratings.ts
```

---

## API Reference Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/announcement-review/:model/:announcementId` | JWT | Create/update star review (1–5) |
| `GET`  | `/announcement-review/:announcementId` | Public | Get all reviews for an announcement |
| `GET`  | `/announcement-review/user/:userId/score` | Public | Get user score (0–100) |
| `GET`  | `/announcement-review/can-review/:model/:id` | JWT | Check if popup should be shown |
| `POST` | `/review/like/:userId` | JWT | Like a user (unchanged) |
| `POST` | `/review/dislike/:userId` | JWT | Dislike a user (unchanged) |
| `POST` | `/review/rate/:userId` | Admin | Manual ±1 rate adjustment (unchanged) |

---

## Frontend Popup Flow

```
Transaction completes (winner assigned / purchase confirmed)
        │
        ▼
Backend sets reviewAvailableAt = now + 1 hour
        │
        ▼
After 1 hour: Frontend polls GET /can-review/:model/:id
        │
        ├── eligible: true  → Show rating popup
        └── eligible: false → Hide popup / already reviewed
```

---

## Data Flow Diagram

```
Winner submits review (stars 1-5)
        │
        ▼
checkEligibility() — guard
 ├─ Bid:        bid.winner === reviewer AND reviewAvailableAt < now
 ├─ Tender:     tender.awardedTo === reviewer AND reviewAvailableAt < now
 └─ DirectSale: purchase.buyer === reviewer AND reviewAvailableAt < now
        │
        ▼
AnnouncementReview upserted
        │
        ▼
recalculateAnnouncementRating()  [1 aggregation]
 → Announcement.ratingAvg, ratingCount, ratingSum, ratingPercent
        │
        ▼
recalculateUserScore()           [3 lean reads + 1 update]
 → User.score (0-100)
        │
        ▼
READ path: O(1) field lookups only — zero aggregations
```
