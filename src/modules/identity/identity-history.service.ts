import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IdentityHistory, IdentityHistoryDocument, ACTION_TYPE } from './identity-history.schema';
import { IdentityDocument } from './identity.schema';

@Injectable()
export class IdentityHistoryService {
  constructor(
    @InjectModel(IdentityHistory.name) private identityHistoryModel: Model<IdentityHistoryDocument>,
  ) {}

  async logHistory(
    identity: IdentityDocument,
    actionType: ACTION_TYPE,
    adminId?: string,
    notes?: string
  ): Promise<IdentityHistoryDocument> {
    const historyEntry = new this.identityHistoryModel({
      identity: identity._id,
      user: identity.user,
      actionType,
      conversionType: identity.conversionType,
      admin: adminId,
      notes,
    });
    return historyEntry.save();
  }

  async getHistory(): Promise<IdentityHistoryDocument[]> {
    return this.identityHistoryModel.find()
      .populate('user', 'firstName lastName email avatarUrl type isVerified isCertified entreprise')
      .populate('admin', 'firstName lastName email type')
      // Removed populate identity here to keep the query lighter, but can add if needed
      .sort({ createdAt: -1 }) // Sort by latest first
      .exec();
  }
}
