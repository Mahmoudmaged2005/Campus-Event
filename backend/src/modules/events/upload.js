import multer from 'multer';
import { AppError } from '../../shared/errors.js';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const readOneImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single('image');

export function uploadImage(req, res, next) {
  readOneImage(req, res, function (error) {
    if (!error) {
      next();
      return;
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(413, 'The image can be at most 2 MB'));
      return;
    }
    if (error instanceof multer.MulterError) {
      next(new AppError(400, 'Send one file in the field "image"'));
      return;
    }
    next(error);
  });
}
