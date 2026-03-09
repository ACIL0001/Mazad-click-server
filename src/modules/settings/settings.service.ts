import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting, SettingDocument } from './schemas/setting.schema';

@Injectable()
export class SettingsService {
    constructor(
        @InjectModel(Setting.name) private settingModel: Model<SettingDocument>,
    ) { }

    async getSettings(): Promise<any> {
        const settings = await this.settingModel.find().exec();
        const result: Record<string, any> = {};
        settings.forEach(setting => {
            result[setting.key] = setting.value;
        });
        return result;
    }

    async setSetting(key: string, value: any): Promise<Setting> {
        return this.settingModel.findOneAndUpdate(
            { key },
            { value },
            { new: true, upsert: true }
        ).exec();
    }

    async setTheme(themeData: { tenderColor: string, auctionColor: string, directSaleColor: string }): Promise<any> {
        const updates = [];
        if (themeData.tenderColor) {
            updates.push(this.setSetting('tenderColor', themeData.tenderColor));
        }
        if (themeData.auctionColor) {
            updates.push(this.setSetting('auctionColor', themeData.auctionColor));
        }
        if (themeData.directSaleColor) {
            updates.push(this.setSetting('directSaleColor', themeData.directSaleColor));
        }
        await Promise.all(updates);
        return this.getSettings();
    }
}
