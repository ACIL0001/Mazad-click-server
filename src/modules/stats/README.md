# MazadClick Stats Module

The Stats module provides comprehensive analytics and statistics for the MazadClick auction platform. It aggregates data from all modules to provide insights into user activity, auction performance, communication metrics, system health, and business analytics.

## Overview

This module analyzes data from 16 core modules:
- **User Management**: user, auth, session, otp, identity, apikey
- **Auction System**: bid, offer, participant, category, subcategory
- **Communication**: chat, messages, notification
- **Content**: comment, review, attachment
- **Business**: subscription

## Available Endpoints

### Core Statistics Endpoints

#### `GET /stats/overview`
Returns a complete platform overview with all statistics.

**Response Format:**
```json
{
  "users": { /* UserStats */ },
  "auctions": { /* AuctionStats */ },
  "communication": { /* CommunicationStats */ },
  "system": { /* SystemStats */ },
  "business": { /* BusinessStats */ },
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

#### `GET /stats/users`
Returns detailed user statistics.

**Response Format:**
```json
{
  "total": 1250,
  "verified": 1100,
  "active": 1180,
  "banned": 15,
  "byType": {
    "admin": 5,
    "professional": 450,
    "buyer": 720,
    "reseller": 75
  },
  "byGender": {
    "male": 680,
    "female": 520,
    "other": 50
  },
  "recentRegistrations": {
    "today": 12,
    "thisWeek": 85,
    "thisMonth": 340
  }
}
```

#### `GET /stats/auctions`
Returns auction and bidding statistics.

**Response Format:**
```json
{
  "total": 2840,
  "active": 156,
  "completed": 2580,
  "pending": 89,
  "cancelled": 15,
  "totalBids": 2840,
  "totalOffers": 18670,
  "totalParticipants": 5240,
  "averageBidsPerAuction": 6.57,
  "topCategories": [
    { "name": "Electronics", "count": 845 },
    { "name": "Fashion", "count": 623 },
    { "name": "Home & Garden", "count": 456 }
  ],
  "recentActivity": {
    "today": 8,
    "thisWeek": 42,
    "thisMonth": 189
  }
}
```

#### `GET /stats/communication`
Returns communication and engagement statistics.

**Response Format:**
```json
{
  "totalMessages": 45720,
  "totalChats": 3240,
  "totalNotifications": 12890,
  "totalComments": 8960,
  "totalReviews": 4520,
  "averageRating": 4.3,
  "notificationTypes": {
    "auction": 8940,
    "offer": 2850,
    "general": 1100
  },
  "messageActivity": {
    "today": 234,
    "thisWeek": 1680,
    "thisMonth": 7240
  }
}
```

#### `GET /stats/system`
Returns system health and resource usage statistics.

**Response Format:**
```json
{
  "totalAttachments": 15640,
  "totalSessions": 8920,
  "activeSessions": 245,
  "totalOtpRequests": 3450,
  "verifiedOtps": 3280,
  "attachmentSizeByType": [
    { "type": "image/jpeg", "totalSize": 2840960000, "count": 8920 },
    { "type": "image/png", "totalSize": 1960440000, "count": 5240 }
  ],
  "storageUsed": 4801400000,
  "apiCalls": {
    "today": 15680,
    "thisWeek": 98750,
    "thisMonth": 425600
  }
}
```

#### `GET /stats/business`
Returns business and subscription metrics.

**Response Format:**
```json
{
  "totalSubscriptions": 890,
  "activeSubscriptions": 720,
  "revenue": {
    "total": 125400,
    "thisMonth": 8960,
    "thisYear": 89750
  },
  "popularPlans": [
    { "planName": "Professional", "subscribers": 450 },
    { "planName": "Premium", "subscribers": 240 }
  ]
}
```

### Dashboard Endpoints

#### `GET /stats/summary`
Returns a condensed summary for quick overview.

#### `GET /stats/dashboard`
Returns formatted data optimized for dashboard widgets and charts.

**Response Format:**
```json
{
  "widgets": [
    {
      "title": "Total Users",
      "value": 1250,
      "change": "+85",
      "changeType": "increase",
      "icon": "users"
    }
  ],
  "charts": {
    "userGrowth": {
      "labels": ["Today", "This Week", "This Month"],
      "data": [12, 85, 340]
    },
    "auctionActivity": {
      "labels": ["Active", "Completed", "Pending", "Cancelled"],
      "data": [156, 2580, 89, 15]
    },
    "userTypes": {
      "labels": ["Professional", "Buyer", "Reseller", "Admin"],
      "data": [450, 720, 75, 5]
    },
    "topCategories": [
      { "name": "Electronics", "count": 845 }
    ]
  }
}
```

#### `GET /stats/real-time`
Returns real-time statistics for live monitoring.

**Response Format:**
```json
{
  "online": {
    "users": 245,
    "activeAuctions": 156
  },
  "activity": {
    "todayRegistrations": 12,
    "todayAuctions": 8,
    "todayMessages": 234
  },
  "system": {
    "activeSessions": 245,
    "totalSessions": 8920,
    "storageUsed": 4801400000
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Data Types

### UserStats
- **total**: Total number of users
- **verified**: Number of verified users
- **active**: Number of active users
- **banned**: Number of banned users
- **byType**: Breakdown by user type (admin, professional, buyer, reseller)
- **byGender**: Breakdown by gender
- **recentRegistrations**: New registrations (today, this week, this month)

### AuctionStats
- **total**: Total number of auctions
- **active/completed/pending/cancelled**: Auctions by status
- **totalBids/totalOffers/totalParticipants**: Bid-related metrics
- **averageBidsPerAuction**: Average participation per auction
- **topCategories**: Most popular auction categories
- **recentActivity**: New auctions by time period

### CommunicationStats
- **totalMessages/totalChats**: Communication volume
- **totalNotifications/totalComments/totalReviews**: Engagement metrics
- **averageRating**: Platform-wide average rating
- **notificationTypes**: Breakdown by notification type
- **messageActivity**: Message volume by time period

### SystemStats
- **totalAttachments/totalSessions**: System resource usage
- **activeSessions**: Currently active user sessions
- **attachmentSizeByType**: Storage usage by file type
- **storageUsed**: Total storage consumed
- **apiCalls**: API usage metrics

### BusinessStats
- **totalSubscriptions/activeSubscriptions**: Subscription metrics
- **revenue**: Revenue breakdown by time period
- **popularPlans**: Most subscribed plans

## Usage Examples

### Frontend Integration
```typescript
// React component example
const DashboardStats = () => {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    fetch('/api/stats/dashboard')
      .then(res => res.json())
      .then(setStats);
  }, []);
  
  return (
    <div>
      {stats?.widgets.map(widget => (
        <StatsWidget key={widget.title} {...widget} />
      ))}
    </div>
  );
};
```

### Real-time Monitoring
```typescript
// WebSocket integration for real-time stats
const useRealTimeStats = () => {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/stats/real-time')
        .then(res => res.json())
        .then(setStats);
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return stats;
};
```

## Performance Considerations

1. **Caching**: Results are computed on-demand but should be cached for production use
2. **Async Processing**: All statistics are computed asynchronously
3. **Error Handling**: Fallback to default values if any service fails
4. **Batch Queries**: Multiple stats are fetched in parallel when possible

## Future Enhancements

1. **Caching Layer**: Implement Redis caching for frequently accessed stats
2. **Historical Data**: Add time-series data for trend analysis
3. **Custom Filters**: Allow filtering by date ranges, user types, etc.
4. **Export Features**: CSV/Excel export functionality
5. **Alerts**: Threshold-based alerts for key metrics
6. **Real-time Updates**: WebSocket integration for live updates

## Error Handling

The service includes comprehensive error handling:
- Individual service failures don't break the entire stats response
- Default values are provided when data is unavailable
- Errors are logged for debugging
- Graceful degradation for partial data availability

## Integration with Existing Modules

The stats module integrates with all existing modules without requiring changes to their APIs. It uses the existing service methods to fetch data and aggregates it into meaningful statistics.

To add this module to your main application module, import it in your `app.module.ts`:

```typescript
import { StatsModule } from './modules/stats/stats.module';

@Module({
  imports: [
    // ... other modules
    StatsModule,
  ],
})
export class AppModule {}
``` 