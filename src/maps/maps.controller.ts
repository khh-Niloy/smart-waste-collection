import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { MapReportsQueryDto } from './dto/map-reports-query.dto';
import { MapsService } from './maps.service';

@ApiTags('Maps')
@Controller('maps')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('reports')
  @ApiOperation({
    summary:
      'Get geolocated waste report markers without exposing citizen PII (Admin only)',
  })
  getReportMarkers(@Query() query: MapReportsQueryDto) {
    return this.mapsService.getReportMarkers(query);
  }
}
