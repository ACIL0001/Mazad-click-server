import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Professional } from '../schema/pro.schema';
import { Model } from 'mongoose';
import { UserService } from '../user.service';
import { CreateUserDto } from 'src/modules/auth/dto/createUser.dto';

@Injectable()
export class ClientService {
  constructor(
    @InjectModel(Professional.name) private readonly sellerModel: Model<Professional>,
    private readonly userService: UserService,
  ) {}

  async create(userDto: CreateUserDto) {
    await this.userService.verifyEmailPhoneNumber({
      email: userDto.email,
      phone: userDto.phone,
    });

    const seller = await this.sellerModel.create(userDto);
    return seller;
  }

  async findAllSellers() {
    return this.sellerModel.find();
  }
}
