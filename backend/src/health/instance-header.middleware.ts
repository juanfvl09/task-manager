import { NextFunction, Request, Response } from 'express';

export function instanceHeader(instanceName: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Backend-Instance', instanceName);
    next();
  };
}
