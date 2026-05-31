import { Controller, Post, Body, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { resolve } from 'path';
import { mkdirSync } from 'fs';
import { VcfUploadService } from './vcf-upload.service';

const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || './uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_EXTENSIONS = ['.vcf', '.vcf.gz'];
const VALID_ANCESTRY_MODES = ['none', 'gnomad'];

@Controller('api/vcf')
export class VcfUploadController {
  constructor(private readonly vcfUploadService: VcfUploadService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          cb(null, `${Date.now()}-${safeName}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const name = file.originalname.toLowerCase();
        const valid = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
        cb(valid ? null : new BadRequestException('Only .vcf and .vcf.gz files are allowed'), valid);
      },
      limits: { fileSize: 20 * 1024 * 1024 * 1024 }, // 20 GB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('ancestryMode') ancestryMode?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const mode = VALID_ANCESTRY_MODES.includes(ancestryMode ?? '') ? ancestryMode! : 'none';
    const vcfFile = await this.vcfUploadService.uploadFromDisk(file.originalname, file.path, mode);
    const { filePath, ...rest } = vcfFile;
    return rest;
  }
}
