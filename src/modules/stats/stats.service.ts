import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../user/schema/user.schema';
import { Bid, BidDocument } from '../bid/schema/bid.schema';
import { Category, CategoryDocument } from '../category/schema/category.schema';
import { Tender, TenderDocument, TENDER_STATUS } from '../tender/schema/tender.schema';
import { RoleCode } from '../apikey/entity/appType.entity';

export interface UserStats {
  total: number;
  byType: {
    admin: number;
    professional: number;
    client: number;
    reseller: number;
  };
}

export interface AuctionStats {
  total: number;
  byStatus: {
    active: number;
    completed: number;
    pending: number;
    cancelled: number;
  };
  byCategory: {
    name: string;
    count: number;
    _id: string;
  }[];
  dailyAverage: number;
  weeklyGrowth: number;
}

export interface TenderStats {
  total: number;
  byStatus: {
    open: number;
    awarded: number;
    closed: number;
    archived: number;
  };
  byType: {
    product: number;
    service: number;
  };
  dailyAverage: number;
  weeklyGrowth: number;
}

export interface CategoryStats {
  name: string;
  count: number;
  _id: string;
}

export interface PlatformOverview {
  users: UserStats;
  auctions: AuctionStats;
  tenders: TenderStats;
  lastUpdated: Date;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Tender.name) private tenderModel: Model<TenderDocument>,
  ) {}

  async getUserStats(): Promise<UserStats> {
    const users = await this.userModel.find({}).lean().exec() as User[];
    
    // Count by type
    const admins = users.filter(user => user.type === RoleCode.ADMIN);
    const professionals = users.filter(user => user.type === RoleCode.PROFESSIONAL);
    const clients = users.filter(user => user.type === RoleCode.CLIENT);
    const resellers = users.filter(user => user.type === RoleCode.RESELLER);

    return {
      total: users.length,
      byType: {
        admin: admins.length,
        professional: professionals.length,
        client: clients.length,
        reseller: resellers.length,
      },
    };
  }

  async getAuctionStats(): Promise<AuctionStats> {
    const bids = await this.bidModel.find({}).populate('productCategory').exec();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get bids from last week for comparison
    const lastWeekBids = await this.bidModel.find({
      createdAt: { $gte: weekAgo }
    }).exec();
    
    // Calculate status counts (for now using basic logic, can be enhanced based on actual bid status)
    const activeBids = bids.filter(bid => {
      const bidDate = new Date((bid as any).createdAt);
      const daysDiff = (now.getTime() - bidDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 30; // Consider bids from last 30 days as active
    });
    
    const completedBids = bids.filter(bid => {
      const bidDate = new Date((bid as any).createdAt);
      const daysDiff = (now.getTime() - bidDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff > 30 && daysDiff <= 90;
    });
    
    // Get category distribution
    const categoryMap = new Map<string, { name: string; count: number; _id: string }>();
    
    for (const bid of bids) {
      if (bid.productCategory) {
        const category = bid.productCategory as any;
        const categoryId = category._id ? category._id.toString() : category.toString();
        const categoryName = category.name || 'Unknown';
        
        if (categoryMap.has(categoryId)) {
          categoryMap.get(categoryId).count++;
        } else {
          categoryMap.set(categoryId, {
            _id: categoryId,
            name: categoryName,
            count: 1
          });
        }
      }
    }
    
    const topCategories = Array.from(categoryMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Calculate daily average over last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentBids = bids.filter(bid => new Date((bid as any).createdAt) >= thirtyDaysAgo);
    const dailyAverage = Math.round(recentBids.length / 30);
    
    // Calculate weekly growth
    const thisWeekBids = lastWeekBids.length;
    const previousWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWeekBids = await this.bidModel.find({
      createdAt: { 
        $gte: previousWeekStart,
        $lt: weekAgo
      }
    }).exec();
    
    const weeklyGrowth = previousWeekBids.length > 0 
      ? Math.round(((thisWeekBids - previousWeekBids.length) / previousWeekBids.length) * 100)
      : thisWeekBids > 0 ? 100 : 0;
    
    return {
      total: bids.length,
      byStatus: {
        active: activeBids.length,
        completed: completedBids.length,
        pending: Math.max(0, bids.length - activeBids.length - completedBids.length - Math.floor(bids.length * 0.1)),
        cancelled: Math.floor(bids.length * 0.1), // Assume 10% cancelled for demo
      },
      byCategory: topCategories,
      dailyAverage,
      weeklyGrowth,
    };
  }

  async getTenderStats(): Promise<TenderStats> {
    const tenders = await this.tenderModel.find({}).exec();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Count by status
    const byStatus = {
      open: tenders.filter(t => t.status === TENDER_STATUS.OPEN).length,
      awarded: tenders.filter(t => t.status === TENDER_STATUS.AWARDED).length,
      closed: tenders.filter(t => t.status === TENDER_STATUS.CLOSED).length,
      archived: tenders.filter(t => t.status === TENDER_STATUS.ARCHIVED).length,
    };

    // Count by type
    const byType = {
      product: tenders.filter(t => t.tenderType === 'PRODUCT').length,
      service: tenders.filter(t => t.tenderType === 'SERVICE').length,
    };

    // Calculate daily average over last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentTenders = tenders.filter(t => new Date((t as any).createdAt) >= thirtyDaysAgo);
    const dailyAverage = Math.round(recentTenders.length / 30);

    // Calculate weekly growth
    const thisWeekTenders = await this.tenderModel.find({
      createdAt: { $gte: weekAgo }
    }).exec();
    
    const previousWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWeekTenders = await this.tenderModel.find({
      createdAt: { 
        $gte: previousWeekStart,
        $lt: weekAgo
      }
    }).exec();

    const weeklyGrowth = previousWeekTenders.length > 0 
      ? Math.round(((thisWeekTenders.length - previousWeekTenders.length) / previousWeekTenders.length) * 100)
      : thisWeekTenders.length > 0 ? 100 : 0;

    return {
      total: tenders.length,
      byStatus,
      byType,
      dailyAverage,
      weeklyGrowth,
    };
  }

  async getCategoryStats(): Promise<CategoryStats[]> {
    const bids = await this.bidModel.find({}).populate('productCategory').exec();
    const categories = await this.categoryModel.find({}).exec();
    
    // Create a map to count bids per category
    const categoryCount = new Map<string, { name: string; count: number; _id: string }>();

    // Initialize all categories with 0 count
    categories.forEach(category => {
      categoryCount.set(category._id.toString(), {
        _id: category._id.toString(),
        name: category.name,
        count: 0
      });
    });

    // Count bids per category
    bids.forEach(bid => {
      if (bid.productCategory) {
        const categoryId = typeof bid.productCategory === 'object' && bid.productCategory._id
          ? bid.productCategory._id.toString()
          : bid.productCategory.toString();
        
        if (categoryCount.has(categoryId)) {
          categoryCount.get(categoryId).count++;
        }
      }
    });

    return Array.from(categoryCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 categories
  }

  async getPlatformOverview(): Promise<PlatformOverview> {
    const [users, auctions, tenders] = await Promise.all([
      this.getUserStats(),
      this.getAuctionStats(),
      this.getTenderStats(),
    ]);
    return {
      users,
      auctions,
      tenders,
      lastUpdated: new Date(),
    };
  }

  async getUserTimeSeries() {
    // Get the last 12 months
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    // Aggregate users by month
    const results = await this.userModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1),
            $lte: now,
          },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]);
    // Map results to month array
    const data = months.map(({ year, month }) => {
      const found = results.find(r => r._id.year === year && r._id.month === month + 1);
      return found ? found.count : 0;
    });
    const labels = months.map(({ month }) =>
      ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"][month]
    );
    return { labels, data };
  }

  async getAuctionTimeSeries() {
    // Get the last 12 months
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    // Aggregate auctions by month
    const results = await this.bidModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1),
            $lte: now,
          },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]);
    // Map results to month array
    const data = months.map(({ year, month }) => {
      const found = results.find(r => r._id.year === year && r._id.month === month + 1);
      return found ? found.count : 0;
    });
    const labels = months.map(({ month }) =>
      ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"][month]
    );
    return { labels, data };
  }

  async getTenderTimeSeries() {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    const results = await this.tenderModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1),
            $lte: now,
          },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]);

    const data = months.map(({ year, month }) => {
      const found = results.find(r => r._id.year === year && r._id.month === month + 1);
      return found ? found.count : 0;
    });

    const labels = months.map(({ month }) =>
      ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"][month]
    );

    return { labels, data };
  }

  async getAuctionStatusTimeSeries() {
    // Get the last 12 months
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    // Aggregate auctions by status and month
    const results = await this.bidModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1),
            $lte: now,
          },
        },
      },
      {
        $addFields: {
          status: {
            $switch: {
              branches: [
                {
                  case: {
                    $lte: [
                      { $divide: [{ $subtract: [now, "$createdAt"] }, 1000 * 60 * 60 * 24] },
                      30
                    ]
                  },
                  then: "active"
                },
                {
                  case: {
                    $and: [
                      { $gt: [{ $divide: [{ $subtract: [now, "$createdAt"] }, 1000 * 60 * 60 * 24] }, 30] },
                      { $lte: [{ $divide: [{ $subtract: [now, "$createdAt"] }, 1000 * 60 * 60 * 24] }, 90] }
                    ]
                  },
                  then: "completed"
                }
              ],
              default: "pending"
            }
          }
        }
      },
      {
        $group: {
          _id: { 
            year: { $year: "$createdAt" }, 
            month: { $month: "$createdAt" },
            status: "$status"
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const seriesData = {
      active: [],
      completed: [],
      pending: []
    };

    months.forEach(({ year, month }) => {
      ['active', 'completed', 'pending'].forEach(status => {
        const found = results.find(r => 
          r._id.year === year && 
          r._id.month === month + 1 && 
          r._id.status === status
        );
        seriesData[status].push(found ? found.count : 0);
      });
    });

    const labels = months.map(({ month }) =>
      ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"][month]
    );

    return { 
      labels, 
      series: [
        { name: 'Enchères Actives', data: seriesData.active },
        { name: 'Enchères Terminées', data: seriesData.completed },
        { name: 'Enchères en Attente', data: seriesData.pending }
      ]
    };
  }

  async getAuctionCategoryTimeSeries() {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    // Get top 5 categories first
    const topCategories = await this.getCategoryStats();
    const topCategoryIds = topCategories.slice(0, 5).map(cat => cat._id);

    // Aggregate auctions by category and month
    const results = await this.bidModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1),
            $lte: now,
          },
          productCategory: { $in: topCategoryIds.map(id => new Types.ObjectId(id)) }
        },
      },
      {
        $group: {
          _id: { 
            year: { $year: "$createdAt" }, 
            month: { $month: "$createdAt" },
            category: "$productCategory"
          },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id.category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      }
    ]);

    const seriesData = {};
    topCategories.slice(0, 5).forEach(cat => {
      seriesData[cat._id] = {
        name: cat.name,
        data: []
      };
    });

    months.forEach(({ year, month }) => {
      topCategories.slice(0, 5).forEach(cat => {
        const found = results.find(r => 
          r._id.year === year && 
          r._id.month === month + 1 && 
          r._id.category.toString() === cat._id
        );
        seriesData[cat._id].data.push(found ? found.count : 0);
      });
    });

    const labels = months.map(({ month }) =>
      ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"][month]
    );

    return { 
      labels, 
      series: Object.values(seriesData)
    };
  }
}