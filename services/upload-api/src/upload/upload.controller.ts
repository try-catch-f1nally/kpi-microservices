import multer, {MulterError} from 'multer';
import {
  Controller,
  Router,
  Request,
  Response,
  NextFunction,
  BadRequestError,
  Middleware,
  UnauthorizedError
} from '@try-catch-f1nally/express-microservice';
import Config from '../config/types/config.interface';
import UploadService from './types/upload.service.interface';
import UploadValidator from './types/upload.validator.interface';

export default class UploadController implements Controller {
  private _router = Router();
  private _config: Config;
  private _uploadService: UploadService;
  private _uploadValidator: UploadValidator;
  private _authMiddleware: Middleware;

  constructor(
    config: Config,
    uploadService: UploadService,
    uploadValidator: UploadValidator,
    authMiddleware: Middleware
  ) {
    this._config = config;
    this._uploadService = uploadService;
    this._uploadValidator = uploadValidator;
    this._authMiddleware = authMiddleware;
    this._initialiseRouter();
  }

  get router() {
    return this._router;
  }

  private _initialiseRouter() {
    this.router.post(
      '/upload',
      this._authMiddleware.middleware,
      this._prepareUserDirMiddleware.bind(this),
      this._uploadMiddleware.bind(this),
      this._uploadErrorHandler.bind(this),
      this._upload.bind(this)
    );
    this.router.post('/upload/status', this._authMiddleware.middleware, this._getUploadingStatus.bind(this));
  }

  private async _prepareUserDirMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      await this._uploadService.prepareForUpload(req.user!.id);
      next();
    } catch (error) {
      next(error);
    }
  }

  private _uploadMiddleware(req: Request, res: Response, next: NextFunction) {
    const userId = req.user!.id;
    return multer({
      limits: {fileSize: this._config.upload.fileSizeLimit},
      storage: multer.diskStorage({
        destination: (req, file, callback) => callback(null, this._uploadService.getUserUploadDir(userId)),
        filename: (req, file, callback) => callback(null, file.originalname)
      })
    }).fields([{name: 'files[]'}])(req, res, next);
  }

  private async _uploadErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
    if (!(err instanceof UnauthorizedError)) {
      await this._uploadService.cleanUserUploadDir(req.user!.id);
    }
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      const {fileSizeLimit} = this._config.upload;
      let fileSizeLimitString;
      if (fileSizeLimit > 1024 ** 3) {
        fileSizeLimitString = `${fileSizeLimit / 1024 ** 3}Gb`;
      } else {
        fileSizeLimitString = `${fileSizeLimit / 1024 ** 2}Mb`;
      }
      next(new BadRequestError(`Max file size is ${fileSizeLimitString}`));
    } else {
      next(err);
    }
  }

  private async _upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!this._uploadValidator.validateUpload(req.body)) {
        throw new BadRequestError('Invalid upload options', this._uploadValidator.validateUpload.errors);
      }
      await this._uploadService.upload(req.user!.id, req.body);
      res.sendStatus(202);
    } catch (error) {
      next(error);
    }
  }

  private async _getUploadingStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await this._uploadService.getUploadingStatus(req.user!.id);
      res.json(status);
    } catch (error) {
      next(error);
    }
  }
}
