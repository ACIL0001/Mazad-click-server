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
  ) { }

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
    try {
      // console.log('🔍 ValidateSession: Verifying token...');
      const { sub, key } = await this.jwtService.verifyAsync(access_token);

      // console.log(`🔍 ValidateSession: Token verified. Sub: ${sub}, Key: ${key}`);

      let session: Session = await this.cacheManager.get(`session:${key}`);

      if (!session) {
        // console.log('🔍 ValidateSession: Session not in cache, looking in DB...');
        session = await this.sessionModel.findOne({ access_key: key });

        if (!session) {
          console.error(`❌ ValidateSession: Session not found in DB for key: ${key}`);
          throw new UnauthorizedException('Invalid session');
        }

        // console.log('✅ ValidateSession: Session found in DB, caching...');
        this.cacheManager.set(`session:${key}`, session);
      }

      if (!session.user) {
        console.error(`❌ ValidateSession: Session has no user property! Session ID: ${session._id}`);
        // If session is seemingly valid but has no user, it's corrupted.
        await this.sessionModel.deleteOne({ _id: session._id });
        throw new UnauthorizedException('Invalid session user');
      }

      // Check if user is fully populated (has _id property)
      // Mongoose populated field becomes a document. If not populated, it's an ObjectId.
      const userDoc = session.user as any;
      if (!userDoc._id) {
        console.error(`❌ ValidateSession: Session user not populated (is ObjectId?). Session ID: ${session._id}`);
        // This implies the User document might be missing or populate failed.
        // We can try to manually find the user to be sure, or just assume invalid.
        // For safety, invalidate session.
        await this.sessionModel.deleteOne({ _id: session._id });
        throw new UnauthorizedException('Invalid session user (not found)');
      }

      if (userDoc._id.toString() !== sub.toString()) {
        console.error(`❌ ValidateSession: User ID mismatch. Session User: ${userDoc._id}, Token Sub: ${sub}`);
        await this.sessionModel.deleteOne({ _id: session._id }); // Security: delete suspicious session
        throw new UnauthorizedException('Invalid session');
      }

      return session;
    } catch (error) {
      console.error('❌ ValidateSession Error:', error.message);
      // Ensure we don't return 500 for auth failures
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Session validation error');
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
