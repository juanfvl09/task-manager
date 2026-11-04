import { IsEnum } from 'class-validator';
import { TaskStatus } from '../task-status.enum.js';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;
}
