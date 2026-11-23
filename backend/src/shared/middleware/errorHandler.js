import { AppError } from '../errors.js';

export function errorHandler(error, req, res, next) {
  if (error instanceof AppError) {
    const body = { error: error.message, ...error.details };
    res.status(error.status).json(body);
    return;
  }

  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'The request body is not valid JSON' });
    return;
  }

  if (error.type === 'entity.too.large') {
    res.status(413).json({ error: 'The request body is too large' });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server' });
}
