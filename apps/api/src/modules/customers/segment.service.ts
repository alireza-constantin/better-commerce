import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerSegment } from './customer-segment.entity';

@Injectable()
export class SegmentService {
  constructor(@InjectRepository(CustomerSegment) private readonly segments: Repository<CustomerSegment>) {}

  list() { return this.segments.find({ order: { createdAt: 'DESC' } }); }

  create(name: string, filters: Record<string, unknown>) {
    const allowed = new Set(['status', 'displayNamePrefix', 'hasMobile']);
    if (Object.keys(filters).some((key) => !allowed.has(key))) {
      throw new BadRequestException('Segment filters contain an unsupported field');
    }
    return this.segments.save(this.segments.create({ name: name.trim(), filters }));
  }
}
