import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class AppService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  getHealth(): {
    status: string;
    service: string;
    database: string;
    timestamp: string;
  } {
    const readyStates: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    return {
      status: 'ok',
      service: 'cleancity-backend',
      database: readyStates[this.connection.readyState] || 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}
