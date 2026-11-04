import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { HealthController } from '../src/health/health.controller.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  const dataSource = { query: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };

  beforeAll(async () => {
    process.env.INSTANCE_NAME = 'backend-test';

    const moduleFixture = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [HealthController],
      providers: [{ provide: DataSource, useValue: dataSource }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health responde 200 con el estado', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('up');
  });

  it('GET /api/instance devuelve la instancia configurada', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/instance')
      .expect(200);

    expect(response.body.instance).toBe('backend-test');
    expect(response.body.hostname).toBeTypeOf('string');
  });
});
