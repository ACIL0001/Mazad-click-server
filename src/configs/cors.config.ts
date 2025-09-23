import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const corsConfig: CorsOptions = {
  origin: (orign, callBack) => {
    // configu
    callBack(null, true);
  },
  credentials: true,
  preflightContinue: false,
};

export default corsConfig;
