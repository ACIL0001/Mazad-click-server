import { RoleCode } from '../modules/apikey/entity/appType.entity';
import { Attachment } from '../modules/attachment/schema/attachment.schema';
import { User } from '../modules/user/schema/user.schema';

/**
 * Computes the API base URL from environment variables or defaults.
 */
export function getApiBaseUrl(): string {
  const apiBaseUrl = process.env.API_BASE_URL ||
    (() => {
      const appHost = process.env.APP_HOST || 'http://localhost';
      const appPort = process.env.APP_PORT || '3000';
      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction && (appHost.includes('localhost') || !appHost.startsWith('https'))) {
        return 'https://mazadclick-server.onrender.com';
      }

      const hostPart = appHost.replace(/\/$/, '');
      return appPort && !hostPart.includes(':') ? `${hostPart}:${appPort}` : hostPart;
    })();
  
  return apiBaseUrl.replace(/\/$/, '');
}

export interface TransformedAttachment {
  url: string;
  fullUrl: string;
  _id: any;
  filename: string;
}

/**
 * Transforms attachment(s) to a minimal shape with fullUrl.
 */
export function transformAttachment(att: Attachment | Attachment[] | any, baseUrl?: string): TransformedAttachment | TransformedAttachment[] | null {
  if (!att) return null;

  const apiBase = baseUrl || getApiBaseUrl();

  if (Array.isArray(att)) {
    return att.filter(Boolean).map(a => {
      if (!a || !a.url) return null;
      const fullUrl = (a as any).fullUrl || `${apiBase}${a.url}`;
      return {
        url: a.url,
        fullUrl: fullUrl,
        _id: a._id,
        filename: a.filename
      };
    }).filter(Boolean) as TransformedAttachment[];
  }

  if (!att.url) return null;
  const fullUrl = (att as any).fullUrl || `${apiBase}${att.url}`;
  return {
    url: att.url,
    fullUrl: fullUrl,
    _id: att._id,
    filename: att.filename
  };
}

export interface SanitizedUser {
  _id: any;
  firstName: string;
  lastName: string;
  username?: string;
  fullName: string;
  photoURL?: string | null;
  avatar?: Attachment | null;
  entreprise?: string;
  companyName?: string;
  rate: number;
  type: RoleCode;
  wilaya?: string;
  secteur?: string;
  isActive: boolean;
  isProfileVisible: boolean;
  createdAt: string;
  email?: string;
  phone?: string;
  contactNumber?: string;
  birthDate?: string;
  subscriptionPlan?: string;
  isBanned?: boolean;
}

/**
 * Sanitizes user data based on the viewer's permissions and item privacy settings.
 */
export function sanitizeUser(u: User | any, currentUser?: User | any, options: { isOwnerAccount?: boolean; isHidden?: boolean; ownerId?: string } = {}): SanitizedUser | any {
  if (!u) return null;
  if (typeof u !== 'object') return u;

  const { isOwnerAccount = false, isHidden = false, ownerId } = options;
  const userId = currentUser?._id?.toString();
  const isAdmin = currentUser?.type && (currentUser.type === RoleCode.ADMIN || currentUser.type === RoleCode.SOUS_ADMIN);
  
  // If ownerId is provided, use it for ownership check, otherwise try u._id
  const targetUserId = ownerId || u._id?.toString() || u.id;
  const isOwner = userId && targetUserId === userId;
  const isPrivileged = isAdmin || isOwner;

  // If hidden is true and user is not privileged, hide owner identity
  if (isOwnerAccount && isHidden && !isPrivileged) {
    return {
      _id: u._id,
      username: 'Anonyme',
      firstName: 'Anonyme',
      lastName: '',
      entreprise: 'Anonyme',
      companyName: 'Anonyme',
      avatar: null,
      photoURL: null,
      rate: u.rate || u.rating
    };
  }

  const result: any = {
    _id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    fullName: (u as any).fullName || (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username),
    photoURL: (u as any).photoURL,
    avatar: u.avatar,
    entreprise: u.entreprise,
    companyName: u.companyName,
    rate: u.rate || u.rating,
    type: u.type,
    wilaya: u.wilaya,
    secteur: u.secteur,
    isActive: u.isActive,
    isProfileVisible: u.isProfileVisible,
    createdAt: u.createdAt
  };

  // Only include contact info if user is privileged OR it's the user's own info
  const isSelf = userId && (u._id?.toString() === userId || u.id === userId);
  if (isPrivileged || isSelf) {
    result.email = u.email;
    result.phone = u.phone;
    result.contactNumber = u.contactNumber;
    result.birthDate = u.birthDate;
    result.subscriptionPlan = u.subscriptionPlan;
    result.isBanned = u.isBanned;
  }

  return result;
}

/**
 * Normalizes media fields ensuring they are arrays.
 */
export function normalizeMediaArray(media: string | string[]): string[] {
  if (!media) return [];
  return Array.isArray(media) ? media : [media];
}

/**
 * Validates ObjectId format.
 */
export function isValidObjectId(id: string): boolean {
  return !!id && /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Adds professionalOnly filter to a query if the user is not a professional.
 */
export function addProfessionalFilter(query: any, user?: User | any): any {
  const isProfessional = user?.type === RoleCode.PROFESSIONAL || user?.type === RoleCode.ADMIN || user?.type === RoleCode.SOUS_ADMIN;
  if (!isProfessional) {
    query.professionalOnly = { $ne: true };
  }
  return query;
}

