import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../common/enums/role.enum';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AssignTeamDto } from './dto/assign-team.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { OverridePriorityDto } from './dto/override-priority.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { UpdateReportStatusDto } from './dto/update-status.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Roles(Role.CITIZEN)
  @ApiOperation({ summary: 'Submit a new waste report (Citizen only)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.reportsService.createReport(user.id, dto);
  }

  @Get('my-summary')
  @Roles(Role.CITIZEN)
  @ApiOperation({
    summary:
      'Get citizen dashboard summary counts, recent complaints, and map markers',
  })
  getMySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('timeframe') timeframe?: 'month' | 'all',
  ) {
    return this.reportsService.getCitizenSummary(
      user.id,
      timeframe === 'month' ? 'month' : 'all',
    );
  }

  @Get('my')
  @Roles(Role.CITIZEN)
  @ApiOperation({
    summary: 'List authenticated citizen complaints with filters & pagination',
  })
  findMyReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryReportsDto,
  ) {
    return this.reportsService.findMyReports(user.id, query);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Search, filter, and paginate all reports (Admin only)',
  })
  findAll(@Query() query: QueryReportsDto) {
    return this.reportsService.findAllForAdmin(query);
  }

  @Get(':id')
  @Roles(Role.CITIZEN, Role.ADMIN)
  @ApiOperation({
    summary: 'Get waste report details and status history (Owner or Admin)',
  })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.findOneById(id, user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update report collection status (Admin only)' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, user.id, dto);
  }

  @Patch(':id/assign-team')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Assign an active collection team to a report (Admin only)',
  })
  assignTeam(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignTeamDto,
  ) {
    return this.reportsService.assignTeam(id, user.id, dto);
  }

  @Patch(':id/priority')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Override suggested report priority with audit reason (Admin only)',
  })
  overridePriority(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OverridePriorityDto,
  ) {
    return this.reportsService.overridePriority(id, user.id, dto);
  }
}
