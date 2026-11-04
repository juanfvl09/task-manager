import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskStatus } from './task-status.enum.js';
import { Task } from './task.entity.js';
import { TasksService } from './tasks.service.js';

describe('TasksService', () => {
  let service: TasksService;

  const repository = {
    find: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };

  const buildTask = (): Task => ({
    id: '3f6c4a0e-2b1c-4d8f-9a1e-5c7d2e9f0b11',
    title: 'Preparar la sustentación',
    description: 'Revisar el diagrama de contenedores',
    status: TaskStatus.PENDING,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: repository },
      ],
    }).compile();

    service = module.get(TasksService);
  });

  it('lista las tareas ordenadas por fecha de creación descendente', async () => {
    const task = buildTask();
    repository.find.mockResolvedValue([task]);

    const result = await service.findAll();

    expect(result).toEqual([task]);
    expect(repository.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
    });
  });

  it('devuelve una tarea por id', async () => {
    const task = buildTask();
    repository.findOneBy.mockResolvedValue(task);

    await expect(service.findOne(task.id)).resolves.toEqual(task);
    expect(repository.findOneBy).toHaveBeenCalledWith({ id: task.id });
  });

  it('lanza NotFoundException si la tarea no existe', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('crea una tarea a partir del DTO', async () => {
    const dto = { title: 'Nueva tarea', description: 'Detalle' };
    repository.create.mockReturnValue(dto);
    repository.save.mockResolvedValue(Object.assign(buildTask(), dto));

    const result = await service.create(dto);

    expect(repository.create).toHaveBeenCalledWith(dto);
    expect(repository.save).toHaveBeenCalledWith(dto);
    expect(result.title).toBe('Nueva tarea');
  });

  it('actualiza título y descripción', async () => {
    const task = buildTask();
    repository.findOneBy.mockResolvedValue(task);
    repository.save.mockImplementation((t: Task) => Promise.resolve(t));

    const result = await service.update(task.id, { title: 'Editada' });

    expect(result.title).toBe('Editada');
    expect(result.description).toBe('Revisar el diagrama de contenedores');
  });

  it('cambia el estado de la tarea', async () => {
    const task = buildTask();
    repository.findOneBy.mockResolvedValue(task);
    repository.save.mockImplementation((t: Task) => Promise.resolve(t));

    const result = await service.updateStatus(task.id, {
      status: TaskStatus.COMPLETED,
    });

    expect(result.status).toBe(TaskStatus.COMPLETED);
  });

  it('elimina una tarea existente', async () => {
    const task = buildTask();
    repository.findOneBy.mockResolvedValue(task);
    repository.remove.mockResolvedValue(undefined);

    await expect(service.remove(task.id)).resolves.toBeUndefined();
    expect(repository.remove).toHaveBeenCalledWith(task);
  });
});
