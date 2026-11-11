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
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { CreateTeamDto } from './dto/create-team.dto';
import { QueryTeamsDto } from './dto/query-teams.dto';
import { UpdateTeamStatusDto } from './dto/update-team-status.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@ApiTags('Collection Teams')
@Controller('teams')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new collection team (Admin only)' })
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List collection teams with workload counts (Admin only)',
  })
  findAll(@Query() query: QueryTeamsDto) {
    return this.teamsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get collection team details and assigned reports (Admin only)',
  })
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update collection team details (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Activate or deactivate a collection team (Admin only)',
  })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTeamStatusDto) {
    return this.teamsService.updateStatus(id, dto);
  }
}

