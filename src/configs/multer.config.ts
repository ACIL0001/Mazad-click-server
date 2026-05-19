import { ConfigService } from '@nestjs/config';
import { MulterModuleOptions } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

const UPLOADS_DIR = 'uploads';

const ensureUploadsDirectoryExists = (destinationPath: string) => {
    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
    }
};

const generateUniqueFilename = (req: any, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
    const name = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9-]/g, '_');
    const fileExtName = extname(file.originalname);
    const randomName = Array(4)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join('');
    callback(null, `${name}-${randomName}${fileExtName}`);
};

export const multerConfigFactory = async (configService: ConfigService): Promise<MulterModuleOptions> => {
    const destinationPath = join(process.cwd(), UPLOADS_DIR);
    ensureUploadsDirectoryExists(destinationPath);
    return {
        storage: diskStorage({
            destination: destinationPath,
            filename: generateUniqueFilename,
        }),
    };
};
