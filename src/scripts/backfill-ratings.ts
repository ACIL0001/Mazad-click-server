/**
 * One-time backfill migration script.
 * Populates ratingAvg, ratingCount, ratingSum, ratingPercent on all existing announcements
 * and recomputes User.score for all sellers.
 *
 * Usage (from Mazad-click-server/):
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-ratings.ts
 *
 * The script is idempotent — safe to re-run (it just recalculates from current Review data).
 */

import mongoose, { Types } from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

// ─── Minimal inline schemas ────────────────────────────────────────────────────

const AnnouncementReviewSchema = new mongoose.Schema({
  reviewer:          { type: Types.ObjectId, ref: 'User' },
  announcement:      { type: Types.ObjectId },
  announcementModel: { type: String },
  seller:            { type: Types.ObjectId, ref: 'User' },
  stars:             { type: Number },
  comment:           { type: String },
}, { timestamps: true });

const ratingFields = {
  ratingSum:     { type: Number, default: 0 },
  ratingCount:   { type: Number, default: 0 },
  ratingAvg:     { type: Number, default: 0 },
  ratingPercent: { type: Number, default: 0 },
};

const BidSchema         = new mongoose.Schema({ owner: Types.ObjectId, ...ratingFields }, { strict: false });
const DirectSaleSchema  = new mongoose.Schema({ owner: Types.ObjectId, ...ratingFields }, { strict: false });
const TenderSchema      = new mongoose.Schema({ owner: Types.ObjectId, ...ratingFields }, { strict: false });
const UserSchema        = new mongoose.Schema({ score: { type: Number, default: 0 } }, { strict: false });

// ─── Main ──────────────────────────────────────────────────────────────────────

async function backfill() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');
  await mongoose.connect(uri);
  const ReviewModel   = mongoose.model('AnnouncementReview', AnnouncementReviewSchema);
  const BidModel      = mongoose.model('Bid', BidSchema);
  const SaleModel     = mongoose.model('DirectSale', DirectSaleSchema);
  const TenderModel   = mongoose.model('Tender', TenderSchema);
  const UserModel     = mongoose.model('User', UserSchema);

  const collections = [
    { model: BidModel,    name: 'Bid' },
    { model: SaleModel,   name: 'DirectSale' },
    { model: TenderModel, name: 'Tender' },
  ];

  // ── Step 1: Backfill rating caches on all announcement documents ────────────
  for (const { model, name } of collections) {
    const docs = await model.find({}, '_id owner').lean();
    let updated = 0;

    for (const doc of docs) {
      const [agg] = await ReviewModel.aggregate([
        { $match: { announcement: doc._id, announcementModel: name } },
        { $group: {
          _id:   null,
          avg:   { $avg: '$stars' },
          count: { $sum: 1 },
          sum:   { $sum: '$stars' },
        }},
      ]);

      const avg     = agg ? parseFloat((agg.avg as number).toFixed(2)) : 0;
      const count   = (agg?.count ?? 0) as number;
      const sum     = (agg?.sum   ?? 0) as number;
      const percent = parseFloat(((avg / 5) * 100).toFixed(2));

      await model.findByIdAndUpdate(doc._id, {
        ratingAvg: avg,
        ratingCount: count,
        ratingSum: sum,
        ratingPercent: percent,
      });
      updated++;
    }
  }

  // ── Step 2: Recompute User.score for every user ─────────────────────────────
  const users = await UserModel.find({}, '_id').lean();
  let usersUpdated = 0;

  for (const u of users) {
    const [bids, sales, tenders] = await Promise.all([
      BidModel.find({ owner: u._id },    'ratingPercent').lean(),
      SaleModel.find({ owner: u._id },   'ratingPercent').lean(),
      TenderModel.find({ owner: u._id }, 'ratingPercent').lean(),
    ]);

    const all: number[] = [...bids, ...sales, ...tenders].map((d: any) => d.ratingPercent ?? 0);
    const score = all.length
      ? parseFloat((all.reduce((a, b) => a + b, 0) / all.length).toFixed(2))
      : 0;

    await UserModel.findByIdAndUpdate(u._id, { score });
    usersUpdated++;
  }
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
