import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { hostname } from 'node:os';

@Controller()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        instance: this.instanceName,
      });
    }

    return {
      status: 'ok',
      database: 'up',
      instance: this.instanceName,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('instance')
  instance() {
    return {
      instance: this.instanceName,
      hostname: hostname(),
    };
  }

  private get instanceName(): string {
    return this.config.get<string>('INSTANCE_NAME') ?? 'unknown';
  }
}
