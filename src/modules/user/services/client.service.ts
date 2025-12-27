import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Buyer } from '../schema/client.schema';
import { Model } from 'mongoose';
import { UserService } from '../user.service';
import { CreateUserDto } from 'src/modules/auth/dto/createUser.dto';

@Injectable()
export class ClientService {
  constructor(
    @InjectModel(Buyer.name) private readonly clientModel: Model<Buyer>,
    private readonly userService: UserService,
  ) { }

  async create(userDto: CreateUserDto) {
    await this.userService.verifyEmailPhoneNumber({
      email: userDto.email,
      phone: userDto.phone,
    });

    const client = await this.clientModel.create(userDto);
    return client;
  }

  async findAllClients() {
    return this.clientModel.find();
  }
}
