import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CollectionTeam,
  CollectionTeamSchema,
} from './schemas/collection-team.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CollectionTeam.name, schema: CollectionTeamSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class TeamsModule {}
