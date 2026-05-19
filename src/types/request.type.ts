import { Request } from '@nestjs/common';
import { Session } from 'src/modules/session/schema/session.schema';
import { RoleCode } from 'src/modules/apikey/entity/appType.entity';

export interface PublicRequest extends Request {
  appType: RoleCode;
}

export interface ProtectedRequest extends Request {
  session: Session;
}
