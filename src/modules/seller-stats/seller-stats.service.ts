import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bid, BidDocument } from '../bid/schema/bid.schema';
import { Offer, OfferDocument } from '../bid/schema/offer.schema';
import { User, UserDocument } from '../user/schema/user.schema';
import { Category, CategoryDocument } from '../category/schema/category.schema';
import { ViewTracking, ViewTrackingDocument } from './schema/view-tracking.schema';

// Note: Mongoose documents with timestamps: true automatically have createdAt and updatedAt
// We use (document as any).createdAt to access these properties

export interface QuickSummary {
  totalAuctions: number;
  activeAuctions: number;
  totalOffers: number;
  pendingOffers: number;
  totalEarnings: number;
  averagePrice: number;
  conversionRate: number;
  viewsTotal: number;
}

export interface CategoryDistribution {
  name: string;
  value: number;
  percentage: number;
}

export interface PriceRangeData {
  range: string;
  count: number;
  percentage: number;
}

export interface RecentActivity {
  auctions: any[];
  offers: any[];
}

export interface FinancialStats {
  earnings: {
    total: number;
    average: number;
    highest: number;
    pending: number;
  };
  auctions: {
    completed: number;
    active: number;
    total: number;
  };
  offers: {
    accepted: number;
    pending: number;
    total: number;
  };
}

export interface PerformanceStats {
  views: number;
  conversion: number;
  rating: number;
  responseTime: number;
  efficiency: {
    auctionsPerMonth: number;
    averageOffers: number;
    successRate: number;
  };
}

export interface ChartData {
  labels: string[];
  datasets: {
    name: string;
    data: number[];
    color: string;
  }[];
}

@Injectable()
export class SellerStatsService {
  constructor(
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>,
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(ViewTracking.name) private viewTrackingModel: Model<ViewTrackingDocument>,
  ) {}

  async getQuickSummary(userId: string): Promise<QuickSummary> {
    const userObjectId = new Types.ObjectId(userId);
    
    // Get user's auctions
    const userAuctions = await this.bidModel.find({ owner: userObjectId }).exec();
    
    // Get user's offers
    const userOffers = await this.offerModel.find({ owner: userObjectId }).exec();
    
    // Calculate auction stats
    const now = new Date();
    const activeAuctions = userAuctions.filter(auction => {
      const endDate = new Date(auction.endingAt);
      return endDate > now && auction.status === 'OPEN';
    });

    // Calculate offer stats
    const pendingOffers = userOffers.filter(offer => offer.status === 'pending').length;
    const acceptedOffers = userOffers.filter(offer => offer.status === 'accepted').length;
    
    // Calculate earnings (from accepted offers)
    const totalEarnings = userOffers
      .filter(offer => offer.status === 'accepted')
      .reduce((sum, offer) => sum + offer.price, 0);
    
    const averagePrice = acceptedOffers > 0 ? totalEarnings / acceptedOffers : 0;
    
    // Calculate conversion rate (accepted offers / total offers)
    const conversionRate = userOffers.length > 0 ? (acceptedOffers / userOffers.length) * 100 : 0;
    
    // Calculate views from actual view tracking data
    const viewsTotal = await this.viewTrackingModel
      .find({ 
        owner: userObjectId, 
        viewType: 'AUCTION_VIEW' 
      })
      .countDocuments();

    return {
      totalAuctions: userAuctions.length,
      activeAuctions: activeAuctions.length,
      totalOffers: userOffers.length,
      pendingOffers,
      totalEarnings,
      averagePrice,
      conversionRate,
      viewsTotal,
    };
  }

  async getAuctionTimeSeries(userId: string, months: number = 12): Promise<ChartData> {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
    
    // Aggregate auctions by month
    const results = await this.bidModel.aggregate([
      {
        $match: {
          owner: userObjectId,
          createdAt: { $gte: startDate, $lte: now }
        }
      },
      {
        $group: {
          _id: { 
            year: { $year: "$createdAt" }, 
            month: { $month: "$createdAt" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Generate labels for the specified months
    const labels = [];
    const data = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('fr-FR', { month: 'short' });
      labels.push(monthName);
      
      const found = results.find(r => 
        r._id.year === date.getFullYear() && r._id.month === date.getMonth() + 1
      );
      data.push(found ? found.count : 0);
    }

    return {
      labels,
      datasets: [{
        name: 'Auctions',
        data,
        color: '#1976d2'
      }]
    };
  }

  async getOfferTimeSeries(userId: string, months: number = 12): Promise<ChartData> {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
    
    // Aggregate offers by month
    const results = await this.offerModel.aggregate([
      {
        $match: {
          owner: userObjectId,
          createdAt: { $gte: startDate, $lte: now }
        }
      },
      {
        $group: {
          _id: { 
            year: { $year: "$createdAt" }, 
            month: { $month: "$createdAt" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Generate labels for the specified months
    const labels = [];
    const data = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('fr-FR', { month: 'short' });
      labels.push(monthName);
      
      const found = results.find(r => 
        r._id.year === date.getFullYear() && r._id.month === date.getMonth() + 1
      );
      data.push(found ? found.count : 0);
    }

    return {
      labels,
      datasets: [{
        name: 'Offers',
        data,
        color: '#388e3c'
      }]
    };
  }

  async getCategoryDistribution(userId: string): Promise<CategoryDistribution[]> {
    const userObjectId = new Types.ObjectId(userId);
    
    // Aggregate auctions by category
    const results = await this.bidModel.aggregate([
      { $match: { owner: userObjectId } },
      {
        $group: {
          _id: "$productCategory",
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $project: {
          name: '$category.name',
          count: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    const total = results.reduce((sum, item) => sum + item.count, 0);
    
    return results.map(item => ({
      name: item.name,
      value: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100 * 100) / 100 : 0
    }));
  }

  async getPriceRangeDistribution(userId: string): Promise<PriceRangeData[]> {
    const userObjectId = new Types.ObjectId(userId);
    
    // Get user's auctions with their final prices
    const auctions = await this.bidModel.find({ owner: userObjectId }).exec();
    
    const ranges = [
      { min: 0, max: 1000, label: '0 - 1,000 DA' },
      { min: 1000, max: 5000, label: '1,000 - 5,000 DA' },
      { min: 5000, max: 10000, label: '5,000 - 10,000 DA' },
      { min: 10000, max: 25000, label: '10,000 - 25,000 DA' },
      { min: 25000, max: 50000, label: '25,000 - 50,000 DA' },
      { min: 50000, max: Infinity, label: '50,000+ DA' }
    ];

    const distribution = ranges.map(range => {
      const count = auctions.filter(auction => 
        auction.currentPrice >= range.min && auction.currentPrice < range.max
      ).length;
      return {
        range: range.label,
        count,
        percentage: auctions.length > 0 ? (count / auctions.length) * 100 : 0
      };
    });

    return distribution;
  }

  async getRecentActivity(userId: string, limit: number = 10): Promise<RecentActivity> {
    const userObjectId = new Types.ObjectId(userId);
    
    // Get recent auctions
    const recentAuctions = await this.bidModel
      .find({ owner: userObjectId })
      .populate('productCategory', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    // Get recent offers
    const recentOffers = await this.offerModel
      .find({ owner: userObjectId })
      .populate('user', 'firstName lastName')
      .populate('bid', 'title')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return {
      auctions: recentAuctions.map(auction => ({
        _id: auction._id,
        title: auction.title,
        category: auction.productCategory?.name || 'Unknown',
        currentPrice: auction.currentPrice,
        status: auction.status,
        createdAt: (auction as any).createdAt
      })),
      offers: recentOffers.map(offer => ({
        _id: offer._id,
        auctionTitle: offer.bid?.title || 'Unknown Auction',
        buyerName: offer.user ? `${offer.user.firstName} ${offer.user.lastName}` : 'Unknown Buyer',
        price: offer.price,
        status: offer.status,
        createdAt: (offer as any).createdAt
      }))
    };
  }

  async getFinancialStats(userId: string): Promise<FinancialStats> {
    const userObjectId = new Types.ObjectId(userId);
    
    // Get user's offers
    const offers = await this.offerModel.find({ owner: userObjectId }).exec();
    const acceptedOffers = offers.filter(offer => offer.status === 'accepted');
    const pendingOffers = offers.filter(offer => offer.status === 'pending');
    
    // Get user's auctions
    const auctions = await this.bidModel.find({ owner: userObjectId }).exec();
    const activeAuctions = auctions.filter(auction => {
      const endDate = new Date(auction.endingAt);
      return endDate > new Date() && auction.status === 'OPEN';
    });
    const completedAuctions = auctions.filter(auction => {
      const endDate = new Date(auction.endingAt);
      return endDate <= new Date() || auction.status === 'CLOSED';
    });

    const totalEarnings = acceptedOffers.reduce((sum, offer) => sum + offer.price, 0);
    const averageEarnings = acceptedOffers.length > 0 ? totalEarnings / acceptedOffers.length : 0;
    const highestEarnings = acceptedOffers.length > 0 ? Math.max(...acceptedOffers.map(o => o.price)) : 0;
    const pendingEarnings = pendingOffers.reduce((sum, offer) => sum + offer.price, 0);

    return {
      earnings: {
        total: totalEarnings,
        average: averageEarnings,
        highest: highestEarnings,
        pending: pendingEarnings
      },
      auctions: {
        completed: completedAuctions.length,
        active: activeAuctions.length,
        total: auctions.length
      },
      offers: {
        accepted: acceptedOffers.length,
        pending: pendingOffers.length,
        total: offers.length
      }
    };
  }

  async getPerformanceStats(userId: string): Promise<PerformanceStats> {
    const userObjectId = new Types.ObjectId(userId);
    
    // Get user's auctions and offers
    const auctions = await this.bidModel.find({ owner: userObjectId }).exec();
    const offers = await this.offerModel.find({ owner: userObjectId }).exec();
    
    // Calculate performance metrics
    const totalViews = auctions.length * 10; // Mock data - replace with actual view tracking
    const conversionRate = offers.length > 0 ? (offers.filter(o => o.status === 'accepted').length / offers.length) * 100 : 0;
    const averageRating = 4.5; // Mock data - replace with actual rating system
    const responseTime = 2.5; // Mock data - replace with actual response time calculation
    
    // Calculate efficiency metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentAuctions = auctions.filter(auction => new Date((auction as any).createdAt) >= thirtyDaysAgo);
    const auctionsPerMonth = recentAuctions.length;
    
    const averageOffers = auctions.length > 0 ? offers.length / auctions.length : 0;
    const successRate = auctions.length > 0 ? (offers.filter(o => o.status === 'accepted').length / auctions.length) * 100 : 0;

    return {
      views: totalViews,
      conversion: conversionRate,
      rating: averageRating,
      responseTime,
      efficiency: {
        auctionsPerMonth,
        averageOffers,
        successRate
      }
    };
  }

  async getMonthlyStats(userId: string, months: number = 12): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
    
    // Get monthly auction and offer data
    const [auctionData, offerData] = await Promise.all([
      this.getAuctionTimeSeries(userId, months),
      this.getOfferTimeSeries(userId, months)
    ]);

    return {
      labels: auctionData.labels,
      monthlyData: {
        auctions: auctionData.datasets[0].data,
        offers: offerData.datasets[0].data
      }
    };
  }

  async getTopCategories(userId: string, limit: number = 5): Promise<any[]> {
    const userObjectId = new Types.ObjectId(userId);
    
    // Get top categories with revenue data
    const results = await this.bidModel.aggregate([
      { $match: { owner: userObjectId } },
      {
        $group: {
          _id: "$productCategory",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$currentPrice" },
          avgPrice: { $avg: "$currentPrice" }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $project: {
          name: '$category.name',
          count: 1,
          totalRevenue: 1,
          avgPrice: 1
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit }
    ]);

    return results;
  }

  async getPerformanceMetrics(userId: string): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);
    
    // Get user's auctions and offers
    const auctions = await this.bidModel.find({ owner: userObjectId }).exec();
    const offers = await this.offerModel.find({ owner: userObjectId }).exec();
    
    // Calculate metrics
    const totalViews = auctions.length * 10; // Mock data
    const conversionRate = offers.length > 0 ? (offers.filter(o => o.status === 'accepted').length / offers.length) * 100 : 0;
    const offerAcceptanceRate = offers.length > 0 ? (offers.filter(o => o.status === 'accepted').length / offers.length) * 100 : 0;
    const avgResponseTime = 2.5; // Mock data
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const auctionsThisMonth = auctions.filter(auction => new Date((auction as any).createdAt) >= thirtyDaysAgo).length;
    const offersThisMonth = offers.filter(offer => new Date((offer as any).createdAt) >= thirtyDaysAgo).length;

    return {
      totalViews,
      conversionRate,
      offerAcceptanceRate,
      avgResponseTime,
      auctionsThisMonth,
      offersThisMonth
    };
  }

  async getEngagementMetrics(userId: string, days: number = 30): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Get engagement data for the specified period
    const [auctions, offers] = await Promise.all([
      this.bidModel.find({ 
        owner: userObjectId, 
        createdAt: { $gte: startDate, $lte: now } 
      }).exec(),
      this.offerModel.find({ 
        owner: userObjectId, 
        createdAt: { $gte: startDate, $lte: now } 
      }).exec()
    ]);

    return {
      period: `${days} days`,
      auctions: auctions.length,
      offers: offers.length,
      acceptedOffers: offers.filter(o => o.status === 'accepted').length,
      totalViews: auctions.length * 10, // Mock data
      engagementRate: offers.length > 0 ? (offers.filter(o => o.status === 'accepted').length / offers.length) * 100 : 0
    };
  }

  async getSellerRanking(userId: string): Promise<any> {
    // Get all professional users and their stats
    const allSellers = await this.userModel.find({ type: 'PROFESSIONAL' }).exec();
    
    const sellerStats = await Promise.all(
      allSellers.map(async (seller) => {
        const sellerObjectId = new Types.ObjectId(seller._id);
        const auctions = await this.bidModel.find({ owner: sellerObjectId }).exec();
        const offers = await this.offerModel.find({ owner: sellerObjectId }).exec();
        const acceptedOffers = offers.filter(o => o.status === 'accepted');
        
        return {
          userId: seller._id,
          name: seller.getFullName(),
          totalAuctions: auctions.length,
          totalOffers: offers.length,
          acceptedOffers: acceptedOffers.length,
          totalEarnings: acceptedOffers.reduce((sum, offer) => sum + offer.price, 0),
          successRate: offers.length > 0 ? (acceptedOffers.length / offers.length) * 100 : 0
        };
      })
    );

    // Sort by total earnings
    sellerStats.sort((a, b) => b.totalEarnings - a.totalEarnings);
    
    // Find current user's ranking
    const currentUserRank = sellerStats.findIndex(s => s.userId.toString() === userId) + 1;
    const totalSellers = sellerStats.length;

    return {
      currentRank: currentUserRank,
      totalSellers,
      percentile: totalSellers > 0 ? ((totalSellers - currentUserRank + 1) / totalSellers) * 100 : 0,
      topSellers: sellerStats.slice(0, 10)
    };
  }

  async getDashboardOverview(userId: string): Promise<any> {
    const [
      quickSummary,
      categoryDistribution,
      recentActivity,
      financialStats,
      performanceStats,
      topCategories
    ] = await Promise.all([
      this.getQuickSummary(userId),
      this.getCategoryDistribution(userId),
      this.getRecentActivity(userId, 5),
      this.getFinancialStats(userId),
      this.getPerformanceStats(userId),
      this.getTopCategories(userId, 5)
    ]);

    return {
      quickSummary,
      categoryDistribution,
      recentActivity,
      financialStats,
      performanceStats,
      topCategories,
      lastUpdated: new Date()
    };
  }

  // View tracking methods
  async trackView(
    userId: string,
    auctionId: string,
    viewerId?: string,
    viewType: string = 'AUCTION_VIEW',
    metadata?: any
  ): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const auctionObjectId = new Types.ObjectId(auctionId);
    const viewerObjectId = viewerId ? new Types.ObjectId(viewerId) : undefined;

    // Check if view already exists for this user/auction combination
    const existingView = await this.viewTrackingModel.findOne({
      owner: userObjectId,
      auction: auctionObjectId,
      viewer: viewerObjectId,
      viewType: viewType as any
    });

    if (existingView) {
      // Update existing view count and timestamp
      await this.viewTrackingModel.updateOne(
        { _id: existingView._id },
        {
          $inc: { viewCount: 1 },
          $set: { lastViewedAt: new Date() }
        }
      );
    } else {
      // Create new view tracking record
      await this.viewTrackingModel.create({
        owner: userObjectId,
        auction: auctionObjectId,
        viewer: viewerObjectId,
        viewType: viewType as any,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        referrer: metadata?.referrer,
        viewCount: 1,
        lastViewedAt: new Date()
      });
    }
  }

  async trackDashboardView(userId: string, viewerId?: string, metadata?: any): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const viewerObjectId = viewerId ? new Types.ObjectId(viewerId) : undefined;

    // Check if dashboard view already exists for this user
    const existingView = await this.viewTrackingModel.findOne({
      owner: userObjectId,
      viewer: viewerObjectId,
      viewType: 'DASHBOARD_VIEW'
    });

    if (existingView) {
      // Update existing view count and timestamp
      await this.viewTrackingModel.updateOne(
        { _id: existingView._id },
        {
          $inc: { viewCount: 1 },
          $set: { lastViewedAt: new Date() }
        }
      );
    } else {
      // Create new dashboard view tracking record
      await this.viewTrackingModel.create({
        owner: userObjectId,
        viewer: viewerObjectId,
        viewType: 'DASHBOARD_VIEW',
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        referrer: metadata?.referrer,
        viewCount: 1,
        lastViewedAt: new Date()
      });
    }
  }

  async getViewAnalytics(userId: string, days: number = 30): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get view analytics for the specified period
    const viewStats = await this.viewTrackingModel.aggregate([
      {
        $match: {
          owner: userObjectId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$viewType',
          totalViews: { $sum: '$viewCount' },
          uniqueViewers: { $addToSet: '$viewer' },
          totalRecords: { $sum: 1 }
        }
      }
    ]);

    // Get daily view trends
    const dailyTrends = await this.viewTrackingModel.aggregate([
      {
        $match: {
          owner: userObjectId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalViews: { $sum: '$viewCount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    return {
      period: `${days} days`,
      viewStats: viewStats.map(stat => ({
        viewType: stat._id,
        totalViews: stat.totalViews,
        uniqueViewers: stat.uniqueViewers.filter(v => v).length,
        totalRecords: stat.totalRecords
      })),
      dailyTrends
    };
  }
}
