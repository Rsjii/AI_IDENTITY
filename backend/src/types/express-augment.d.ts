import 'express-session';
import 'express-serve-static-core';

declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
      user?: User;
      session?: import('express-session').Session & Partial<import('express-session').SessionData>;
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
      requestId?: string;
    }

    interface Response {
      locals: any;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    cookies?: Record<string, string>;
    user?: Express.User;
    session?: import('express-session').Session & Partial<import('express-session').SessionData>;
    file?: Express.Multer.File;
    files?: Express.Multer.File[];
    requestId?: string;
  }

  interface Response {
    locals: any;
  }
}

