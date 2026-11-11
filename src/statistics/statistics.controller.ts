import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { StatisticsQueryDto } from './dto/statistics-query.dto';
import { StatisticsService } from './statistics.service';

@ApiTags('Statistics')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('public-summary')
  @ApiOperation({
    summary: 'Get public non-PII municipal impact counters for home page',
  })
  getPublicSummary() {
    return this.statisticsService.getPublicSummary();
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Get real-time MongoDB aggregation metrics and charts (Admin only)',
  })
  getOverview(@Query() query: StatisticsQueryDto) {
    return this.statisticsService.getOverview(query);
  }
}
