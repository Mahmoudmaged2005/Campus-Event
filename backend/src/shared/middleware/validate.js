import { AppError } from '../errors.js';

export function validate(schema) {
  return function checkBody(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const fieldName = firstIssue.path.join('.');
      if (fieldName === '' && firstIssue.code === 'invalid_type') {
        throw new AppError(400, 'The request body is missing or not an object');
      }
      if (fieldName === '') {
        throw new AppError(400, firstIssue.message);
      }
      throw new AppError(400, fieldName + ': ' + firstIssue.message);
    }
    req.body = result.data;
    next();
  };
}
