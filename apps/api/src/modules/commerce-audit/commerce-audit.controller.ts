import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiProblemResponse,
  ApiSessionAuthenticated,
} from '../../platform/openapi';
import { PermissionKey } from '../authorization/data';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import {
  CommerceAuditPageResponseDto,
  CommerceAuditQueryDto,
} from './commerce-audit.dto';
import { CommerceAuditService } from './persistence/commerce-audit.service';

@AdminApi()
@ApiTags('Commerce audit')
@ApiSessionAuthenticated()
@Controller('admin/commerce-audit-events')
export class CommerceAuditController {
  constructor(private readonly audit: CommerceAuditService) {}

  @Get()
  @RequirePermissions(PermissionKey.AUDIT_READ)
  @ApiOperation({
    summary: 'List append-only commerce audit events',
    description:
      'Results are newest-first and use stable cursor pagination. Requires `admin.access` and `audit.read`.',
  })
  @ApiOkResponse({ type: CommerceAuditPageResponseDto })
  @ApiProblemResponse(400, 'The cursor or page limit is invalid.')
  list(@Query() query: CommerceAuditQueryDto) {
    return this.audit.list(query);
  }
}
