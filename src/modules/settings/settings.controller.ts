import { Body, Controller, Get, Put, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SettingsService } from './settings.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get()
    @Public()
    async getSettings() {
        return this.settingsService.getSettings();
    }

    @Put('logo')
    @UseGuards(AdminGuard)
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, uniqueSuffix + extname(file.originalname));
            },
        }),
    }))
    async uploadLogo(@UploadedFile() file: Express.Multer.File) {
        if (file) {
            // The file path will be available on the static route setup in app.module.ts
            const url = `/static/${file.filename}`;
            await this.settingsService.setSetting('logoUrl', url);
            return { url };
        }
        return null;
    }

    @Put('theme')
    @UseGuards(AdminGuard)
    async updateTheme(@Body() themeData: { tenderColor: string, auctionColor: string, directSaleColor: string }) {
        await this.settingsService.setTheme(themeData);
        return { success: true };
    }
}
