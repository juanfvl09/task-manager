import { Test } from '@nestjs/testing';
import { TaskStatus } from './task-status.enum.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

describe('TasksController', () => {
  let controller: TasksController;

  const service = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    remove: vi.fn(),
  };

  const id = '3f6c4a0e-2b1c-4d8f-9a1e-5c7d2e9f0b11';

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: service }],
    }).compile();

    controller = module.get(TasksController);
  });

  it('delega el listado en el servicio', async () => {
    service.findAll.mockResolvedValue([]);
    await expect(controller.findAll()).resolves.toEqual([]);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });

  it('delega la consulta por id', async () => {
    service.findOne.mockResolvedValue({ id });
    await expect(controller.findOne(id)).resolves.toEqual({ id });
    expect(service.findOne).toHaveBeenCalledWith(id);
  });

  it('delega la creación', async () => {
    const dto = { title: 'Tarea' };
    service.create.mockResolvedValue({ id, ...dto });
    await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delega la actualización', async () => {
    const dto = { description: 'Otra descripción' };
    service.update.mockResolvedValue({ id, ...dto });
    await controller.update(id, dto);
    expect(service.update).toHaveBeenCalledWith(id, dto);
  });

  it('delega el cambio de estado', async () => {
    const dto = { status: TaskStatus.COMPLETED };
    service.updateStatus.mockResolvedValue({ id, ...dto });
    await controller.updateStatus(id, dto);
    expect(service.updateStatus).toHaveBeenCalledWith(id, dto);
  });

  it('delega la eliminación', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(id);
    expect(service.remove).toHaveBeenCalledWith(id);
  });
});
