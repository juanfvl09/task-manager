import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  const dataSource = { query: vi.fn() };
  const config = { get: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    config.get.mockReturnValue('backend-1');

    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('responde ok cuando la base de datos contesta', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(result.instance).toBe('backend-1');
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('responde 503 cuando la base de datos no contesta', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('devuelve el nombre de la instancia y el hostname', () => {
    const result = controller.instance();

    expect(result.instance).toBe('backend-1');
    expect(typeof result.hostname).toBe('string');
    expect(result.hostname.length).toBeGreaterThan(0);
  });

  it('usa unknown si INSTANCE_NAME no está definida', () => {
    config.get.mockReturnValue(undefined);

    expect(controller.instance().instance).toBe('unknown');
  });
});
