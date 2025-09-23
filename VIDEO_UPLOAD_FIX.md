# Video Upload Fix - Server Side

## Issue Description
The frontend was sending both `thumbs[]` and `videos[]` files to the server, but the server was only configured to handle `thumbs[]` files, resulting in the error "Unexpected field - videos[]".

## Root Cause
The `FilesInterceptor` in the bid controller was configured to only accept files with the fieldname `thumbs[]`, but the frontend was sending files with both `thumbs[]` and `videos[]` fieldnames.

## Solution Applied

### 1. Updated File Interceptor
**File**: `server/src/modules/bid/bid.controller.ts`

**Before**:
```typescript
@UseInterceptors(
  FilesInterceptor('thumbs[]', undefined, {
    // ... configuration
  }),
)
```

**After**:
```typescript
@UseInterceptors(
  AnyFilesInterceptor({
    // ... configuration
  }),
)
```

### 2. Updated File Processing Logic
**Before**: Only processed files based on mimetype
**After**: Process files based on both fieldname and mimetype

```typescript
// Separate images and videos based on fieldname
const imageFiles = files.filter(file => 
  file.fieldname === 'thumbs[]' && file.mimetype.startsWith('image/')
);
const videoFiles = files.filter(file => 
  file.fieldname === 'videos[]' && file.mimetype.startsWith('video/')
);
```

### 3. Enhanced File Filter
Updated the file filter to accept both images and videos:
```typescript
fileFilter: (req, file, cb) => {
  // Allow both images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'), false);
  }
},
```

## Server Architecture Overview

### Core Modules

#### 1. **Bid Module** (`/modules/bid/`)
- **Purpose**: Handles auction/bid creation, management, and processing
- **Key Files**:
  - `bid.controller.ts` - HTTP endpoints for bid operations
  - `bid.service.ts` - Business logic for bid management
  - `bid.schema.ts` - MongoDB schema definition
  - `dto/create-bid.dto.ts` - Data transfer object for bid creation

#### 2. **Attachment Module** (`/modules/attachment/`)
- **Purpose**: Handles file uploads and storage
- **Key Features**:
  - File validation and processing
  - URL generation for file access
  - Support for multiple file types (images, videos, documents)
  - Integration with MongoDB for metadata storage

#### 3. **User Module** (`/modules/user/`)
- **Purpose**: User management and authentication
- **Key Features**:
  - User registration and login
  - Role-based access control (Client, Professional, Admin)
  - User profile management
  - Avatar upload support

#### 4. **Auth Module** (`/modules/auth/`)
- **Purpose**: Authentication and authorization
- **Key Features**:
  - JWT token management
  - Session handling
  - OTP verification
  - Role-based permissions

#### 5. **Notification Module** (`/modules/notification/`)
- **Purpose**: Real-time notifications
- **Key Features**:
  - Database notifications
  - Socket.io integration
  - User-specific notifications
  - Multiple notification types

#### 6. **Socket Gateway** (`/socket/`)
- **Purpose**: Real-time communication
- **Key Features**:
  - WebSocket connections
  - Online user tracking
  - Real-time notifications
  - Chat functionality

### Database Schema

#### Bid Schema
```typescript
{
  owner: ObjectId,           // User who created the bid
  title: String,             // Bid title
  description: String,       // Bid description
  bidType: BID_TYPE,         // PRODUCT or SERVICE
  auctionType: AUCTION_TYPE, // CLASSIC, EXPRESS, AUTO_SUB_BID
  productCategory: ObjectId, // Category reference
  productSubCategory: ObjectId, // Subcategory reference
  thumbs: [ObjectId],        // Image attachments
  videos: [ObjectId],        // Video attachments
  startingPrice: Number,     // Starting bid price
  currentPrice: Number,      // Current highest bid
  reservePrice: Number,      // Minimum acceptable price
  startingAt: Date,          // Auction start time
  endingAt: Date,            // Auction end time
  status: BID_STATUS,        // OPEN, ON_AUCTION, CLOSED, ARCHIVED
  winner: ObjectId,          // Winning user
  place: String,             // Location
  wilaya: String,            // State/Province
  quantity: String,          // Product quantity
  isPro: Boolean,            // Professional auction flag
  hidden: Boolean,           // Name visibility flag
  attributes: [String],      // Product attributes
  comments: [ObjectId]       // Comments array
}
```

#### Attachment Schema
```typescript
{
  user: ObjectId,            // User who uploaded
  fieldname: String,         // Form field name
  originalname: String,      // Original filename
  encoding: String,          // File encoding
  mimetype: String,          // MIME type
  destination: String,       // Storage destination
  filename: String,          // Generated filename
  path: String,              // Full file path
  size: Number,              // File size in bytes
  url: String,               // Public URL
  as: AttachmentAs,          // Attachment type (BID, AVATAR, etc.)
  createdAt: Date            // Upload timestamp
}
```

### File Upload Flow

1. **Frontend** sends FormData with:
   - `data`: JSON string of bid details
   - `thumbs[]`: Array of image files
   - `videos[]`: Array of video files

2. **Server** processes files:
   - `AnyFilesInterceptor` accepts all files
   - Files are filtered by fieldname and mimetype
   - Each file is uploaded via `AttachmentService`
   - Attachment IDs are stored in bid document

3. **Database** stores:
   - Bid document with attachment references
   - Attachment documents with file metadata
   - File URLs for public access

### Key Features

#### 1. **Multi-file Support**
- Images and videos can be uploaded together
- Files are processed separately based on type
- Proper validation for each file type

#### 2. **File Storage**
- Files stored in `./uploads` directory
- Unique filenames generated to prevent conflicts
- Public URLs generated for file access

#### 3. **Real-time Notifications**
- Socket.io integration for real-time updates
- Database notifications for persistence
- User-specific notification targeting

#### 4. **Auction Management**
- Automatic auction end processing
- Winner determination logic
- Chat creation for buyer-seller communication
- Comprehensive notification system

#### 5. **Security**
- File type validation
- File size limits (configurable)
- User authentication required
- Role-based access control

### Configuration

#### Environment Variables
- `DATABASE_URI`: MongoDB connection string
- `DATABASE_NAME`: Database name
- `JWT_SECRET_KEY`: JWT signing key
- `SESSION_SECRET_KEY`: Session encryption key
- `REDIS_HOST/PORT`: Redis configuration
- `SLICKPAY_*`: Payment gateway configuration
- `SATIM_*`: Alternative payment gateway

#### CORS Configuration
- Multiple allowed origins for development
- Credentials support enabled
- Custom headers support

### Testing the Fix

1. **Start the server**:
   ```bash
   cd server
   npm run start:dev
   ```

2. **Test video upload**:
   - Create a new auction with both images and videos
   - Verify files are uploaded successfully
   - Check that both `thumbs` and `videos` arrays are populated

3. **Verify file access**:
   - Check that uploaded files are accessible via `/static/` URLs
   - Verify file metadata is stored correctly

### Future Improvements

1. **File Compression**: Add image/video compression
2. **CDN Integration**: Use CDN for file delivery
3. **File Cleanup**: Implement orphaned file cleanup
4. **Virus Scanning**: Add file virus scanning
5. **Progress Tracking**: Add upload progress tracking

## Conclusion

The video upload issue has been successfully resolved by updating the file interceptor to handle multiple file fieldnames. The server now properly processes both `thumbs[]` and `videos[]` files, storing them as separate attachment types while maintaining the existing functionality for image uploads.
