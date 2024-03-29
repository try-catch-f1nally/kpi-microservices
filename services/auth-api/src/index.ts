import {Application, Log4jsService, AjvService} from '@try-catch-f1nally/express-microservice';
import {config} from './config/config';
import UserModel from './user/user.model';
import AuthValidatorImpl from './auth/auth.validator';
import AuthServiceImpl from './auth/auth.service';
import AuthController from './auth/auth.controller';
import MongoDB from './mongoDb';

const log4jsService = new Log4jsService(config);
const ajvService = new AjvService(config);
const authValidator = new AuthValidatorImpl(ajvService);
const authService = new AuthServiceImpl(config, UserModel);
const authController = new AuthController(config, authService, authValidator);
const mongoDb = new MongoDB(config, log4jsService.getLogger('MongoDB'));

void new Application({
  controllers: [authController],
  logger: log4jsService.getLogger('Application'),
  database: mongoDb,
  config
}).start();
