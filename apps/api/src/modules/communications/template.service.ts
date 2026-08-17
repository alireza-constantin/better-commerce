import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationTemplate } from './communication-template.entity';
import { MessagePurpose } from './message-intent.entity';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(CommunicationTemplate)
    private readonly templates: Repository<CommunicationTemplate>,
  ) {}

  list() {
    return this.templates.find({ order: { key: 'ASC', version: 'DESC' } });
  }

  async create(key: string, purpose: MessagePurpose, body: string) {
    const latest = await this.templates.findOne({ where: { key }, order: { version: 'DESC' } });
    return this.templates.save(
      this.templates.create({
        key,
        purpose,
        body,
        version: (latest?.version ?? 0) + 1,
        active: true,
      }),
    );
  }
}
