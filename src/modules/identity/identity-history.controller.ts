import { Controller, Get, UseGuards } from '@nestjs/common';
import { IdentityHistoryService } from './identity-history.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { AdminGuard } from 'src/common/guards/admin.guard';

@Controller('identity-history')
@UseGuards(AuthGuard, AdminGuard)
export class IdentityHistoryController {
  constructor(private readonly identityHistoryService: IdentityHistoryService) {}

  @Get()
  async getHistory() {
    const history = await this.identityHistoryService.getHistory();
    return history;
  }
}
