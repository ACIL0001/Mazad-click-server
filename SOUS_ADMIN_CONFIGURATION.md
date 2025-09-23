# 🔐 Sous Admin Configuration Guide

## Overview

This guide explains the new **Sous Admin** (Sub-Administrator) role implementation for MazadClick server. The Sous Admin role provides limited administrative access compared to the full Admin role.

## 🎯 Role Hierarchy

```
ADMIN (Level 5)
├── Full system access
├── Can create/delete admin and sous admin users
├── Can manage system settings
└── Has access to all financial and sensitive operations

SOUS_ADMIN (Level 4)
├── Limited administrative access
├── Can manage users, bids, and content
├── Cannot create/delete admin users
└── Cannot access sensitive financial settings

RESELLER (Level 3)
PROFESSIONAL (Level 2)
CLIENT (Level 1)
```

## 🔧 Environment Configuration

Add these variables to your `.env` file:

```env
# ====================================
# ADMIN ACCOUNT CONFIGURATION
# ====================================
ADMIN_FIRSTNAME=Admin
ADMIN_LASTNAME=Administrator
ADMIN_EMAIL=admin@mazadclick.com
ADMIN_PASSWORD=SecureAdminPassword123!
ADMIN_GENDER=MALE
ADMIN_PHONE=+213123456789

# ====================================
# SOUS ADMIN ACCOUNT CONFIGURATION
# ====================================
SOUS_ADMIN_FIRSTNAME=SousAdmin
SOUS_ADMIN_LASTNAME=Manager
SOUS_ADMIN_EMAIL=sousadmin@mazadclick.com
SOUS_ADMIN_PASSWORD=SecureSousAdminPassword123!
SOUS_ADMIN_GENDER=MALE
SOUS_ADMIN_PHONE=+213987654321
```

## 🏗️ Technical Implementation

### 1. New Role Added
```typescript
export enum RoleCode {
  CLIENT = 'CLIENT',
  PROFESSIONAL = 'PROFESSIONAL',
  RESELLER = 'RESELLER',
  SOUS_ADMIN = 'SOUS_ADMIN',  // 👈 NEW
  ADMIN = 'ADMIN',
}
```

### 2. Guards Created
- **AdminOnlyGuard**: Restricts access to full admin users only
- **SousAdminGuard**: Allows both admin and sous admin access
- **RoleHierarchyGuard**: Provides granular role-based access control

### 3. Services Created
- **AdminService**: Manages admin and sous admin user creation and management
- **Auto-seeding**: Automatically creates admin and sous admin users on startup

### 4. API Endpoints

#### Admin Management Endpoints
```
GET /admin/all                    # Get all admin users (Admin only)
GET /admin/admins-only           # Get admin users only (Admin only)
GET /admin/sous-admins           # Get sous admin users (Admin + Sous Admin)
POST /admin/create-admin         # Create new admin (Admin only)
POST /admin/create-sous-admin    # Create new sous admin (Admin only)
PUT /admin/update/:id            # Update admin user
DELETE /admin/delete/:id         # Delete admin user (Admin only)
PUT /admin/change-password/:id   # Change admin password
GET /admin/profile               # Get current admin profile
POST /admin/check-permission     # Check specific permissions
```

## 🛡️ Permission Matrix

| Action | Admin | Sous Admin | Description |
|--------|-------|------------|-------------|
| **User Management** |
| View Users | ✅ | ✅ | View all platform users |
| Update User Status | ✅ | ✅ | Ban/unban users |
| Delete Users | ✅ | ❌ | Permanently delete users |
| **Admin Management** |
| Create Admin | ✅ | ❌ | Create new admin users |
| Create Sous Admin | ✅ | ❌ | Create new sous admin users |
| Delete Admin | ✅ | ❌ | Delete admin/sous admin users |
| **Content Management** |
| Manage Bids | ✅ | ✅ | Moderate auction content |
| Manage Categories | ✅ | ✅ | Add/edit product categories |
| Moderate Content | ✅ | ✅ | Review and moderate content |
| **System Management** |
| System Settings | ✅ | ❌ | Configure system parameters |
| Payment Gateways | ✅ | ❌ | Manage payment configurations |
| Financial Reports | ✅ | ❌ | Access financial data |
| **Notifications** |
| Send Notifications | ✅ | ✅ | Send platform notifications |
| View Notifications | ✅ | ✅ | View notification history |
| **Statistics** |
| View Basic Stats | ✅ | ✅ | Platform usage statistics |
| View Financial Stats | ✅ | ❌ | Revenue and payment statistics |

## 🚀 Usage Examples

### 1. Check User Permissions
```typescript
// In your controller
@Post('check-permission')
@UseGuards(SousAdminGuard)
async checkPermission(@Body() data: { action: string }) {
  // Returns permission status for the action
}
```

### 2. Role-Based Route Protection
```typescript
// Admin only endpoint
@UseGuards(AdminOnlyGuard)
@Delete('sensitive-operation')
async sensitiveOperation() { /* ... */ }

// Admin or Sous Admin endpoint  
@UseGuards(SousAdminGuard)
@Get('moderate-content')
async moderateContent() { /* ... */ }
```

### 3. Hierarchical Permission Check
```typescript
// Using the role hierarchy guard
@UseGuards(RoleHierarchyGuard)
@RequiresRole(RoleCode.SOUS_ADMIN)
@Post('manage-users')
async manageUsers() { /* ... */ }
```

## 🔄 Migration Guide

### For Existing Admins
1. Existing admin users remain unchanged
2. All current admin functionality is preserved
3. New guards provide additional security layers

### For New Installations
1. Set environment variables for both admin and sous admin
2. Start the server - users will be created automatically
3. Admin and sous admin can log in immediately

### For Existing Projects
1. Add new environment variables
2. Restart the server
3. Sous admin user will be created automatically
4. Update any existing route guards as needed

## 🛠️ Customization

### Adding New Permissions
1. Update the permission matrix in `AdminController.checkPermission()`
2. Add new guard conditions if needed
3. Update role hierarchy levels if required

### Creating Custom Guards
```typescript
@Injectable()
export class CustomPermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().session.user;
    return this.hasCustomPermission(user.type);
  }
}
```

## 🔐 Security Considerations

1. **Strong Passwords**: Use complex passwords for admin accounts
2. **Environment Security**: Keep .env files secure and excluded from version control
3. **Session Management**: Admin sessions use the same JWT security as regular users
4. **Audit Trail**: All admin actions should be logged for security auditing
5. **Principle of Least Privilege**: Sous admins have minimal required permissions

## 📝 Testing

### Manual Testing
```bash
# Test admin creation
curl -X POST http://localhost:3000/admin/create-sous-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "firstName": "Test",
    "lastName": "SousAdmin",
    "email": "test@example.com",
    "password": "TestPassword123!",
    "phone": "+213123456789"
  }'

# Test permission check
curl -X POST http://localhost:3000/admin/check-permission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SOUS_ADMIN_TOKEN" \
  -d '{"action": "MANAGE_BIDS"}'
```

### Expected Responses
- **Admin**: Full access to all endpoints
- **Sous Admin**: Limited access based on permission matrix
- **Other Users**: Forbidden (403) for admin endpoints

## 🎉 Benefits

1. **Enhanced Security**: Granular permission control
2. **Delegation**: Admins can delegate tasks to sous admins
3. **Scalability**: Multiple admin-level users with appropriate access
4. **Audit Control**: Clear separation of admin responsibilities
5. **Risk Mitigation**: Limited access reduces potential for mistakes

---

**Note**: This implementation provides a robust foundation for role-based access control while maintaining security and scalability for the MazadClick platform.
