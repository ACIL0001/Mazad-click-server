import { Injectable } from '@nestjs/common';
import { CreateUserDto } from 'src/modules/auth/dto/createUser.dto';
import { UserService } from '../user.service';
import { InjectModel } from '@nestjs/mongoose';
import { Professional } from '../schema/pro.schema';
import { Model } from 'mongoose';

@Injectable()
export class ProService {
  constructor(
    private readonly userService: UserService,
    @InjectModel(Professional.name) private readonly proModel: Model<Professional>,
  ) {}

  async create(userDto: CreateUserDto) {
    await this.userService.verifyEmailPhoneNumber({
      email: userDto.email,
      phone: userDto.phone,
    });

    const pro = await this.proModel.create(userDto);
    return pro;
  }

  async findAllProfessionals() {
    return this.proModel.find();
  }
}
