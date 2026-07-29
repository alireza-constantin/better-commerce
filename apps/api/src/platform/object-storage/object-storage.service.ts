import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ObjectStorageService {
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly client: S3Client;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('objectStorage.bucket');
    this.publicBaseUrl = config
      .getOrThrow<string>('objectStorage.publicBaseUrl')
      .replace(/\/+$/, '');
    this.client = new S3Client({
      region: config.getOrThrow<string>('objectStorage.region'),
      endpoint: config.get<string>('objectStorage.endpoint'),
      forcePathStyle: config.get<boolean>('objectStorage.forcePathStyle'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('objectStorage.accessKeyId'),
        secretAccessKey: config.getOrThrow<string>(
          'objectStorage.secretAccessKey',
        ),
      },
    });
  }

  async putImage(key: string, bytes: Buffer): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.publicBaseUrl}/${key
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  }

  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
