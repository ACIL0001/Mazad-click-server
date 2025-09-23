import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Session } from './schema/session.schema';
import { Model } from 'mongoose';
import { User } from 'src/modules/user/schema/user.schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly jwtService: JwtService,
  ) {}

  // TODO: CREATE SESSION AND DOCUMENT IT
  async CreateSession(
    user: User,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const session = await this.sessionModel.create({ user: user });
    const access_token = await this.jwtService.signAsync(
      {
        sub: user._id,
        key: session.access_key,
      },
      { expiresIn: '15d' },
    );

    const refresh_token = await this.jwtService.signAsync(
      {
        sub: user._id,
        key: session.refresh_key,
      },
      {
        expiresIn: '30d', // 30 days
      },
    );

    return { access_token, refresh_token };
  }

  // TODO: VALIDATE SESSION AND DOCUMENT IT
  async ValidateSession(access_token: string): Promise<Session> {
    console.log('🔐 SessionService: Validating session with token:', access_token ? 'Present' : 'Missing');
    console.log('🔐 SessionService: Token preview:', access_token ? access_token.substring(0, 20) + '...' : 'none');
    
    try {
      const { sub, key } = await this.jwtService.verifyAsync(access_token);
      console.log('🔐 SessionService: JWT verified, sub:', sub, 'key:', key);

      let session: Session = await this.cacheManager.get(`session:${key}`);
      console.log('🔐 SessionService: Session from cache:', session ? 'Found' : 'Not found');
      
      if (!session) {
        session = await this.sessionModel.findOne({ access_key: key });
        console.log('🔐 SessionService: Session from DB:', session ? 'Found' : 'Not found');
        
        if (!session) {
          console.log('🔐 SessionService: No session found in DB');
          throw new UnauthorizedException('Invalid session');
        }

        this.cacheManager.set(`session:${key}`, session);
        console.log('🔐 SessionService: Session cached');
      }

      if (!(session.user._id.toString() == sub.toString())) {
        console.log('🔐 SessionService: User ID mismatch');
        throw new UnauthorizedException('Invalid session');
      }

      console.log('🔐 SessionService: Session validated successfully');
      return session;
    } catch (error) {
      console.log('🔐 SessionService: Error validating session:', error.message);
      throw error;
    }
  }

  async RefreshSession(
    refresh_token: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const { sub, key } = await this.jwtService.verifyAsync(refresh_token);
    const session = await this.sessionModel.findOne({ refresh_key: key });
    // if (!session) throw new BadRequestException('Invalid RefreshToken'); // TODO: TRANSLATE THIS
    if (!session) throw new HttpException('Invalid RefreshToken', 403); // TODO: TRANSLATE THIS

    if (!(session.user._id.toString() == sub.toString())) {
      throw new BadRequestException('Invalid session');
    }

    this.cacheManager.del(`session:${session.access_key}`);
    const newSession = await this.CreateSession(session.user);
    await this.sessionModel.findByIdAndDelete(session._id);
    return newSession;
  }

  async DeleteSession(session: Session) {
    const _session = await this.sessionModel.findById(session._id);
    if (!_session) throw new BadRequestException('invalid session');
    this.cacheManager.del(`session:${session.access_key}`);
    return this.sessionModel.findByIdAndDelete(session._id);
  }
}
