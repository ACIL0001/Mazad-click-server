import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Participant, ParticipantDocument } from './schema/participant.schema';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class ParticipantService {
  constructor(
    @InjectModel(Participant.name) private participantModel: Model<ParticipantDocument>,
    private i18nService: I18nService,
  ) {}

  async findAll(): Promise<Participant[]> {
    return this.participantModel.find().exec();
  }

  async findOne(id: string): Promise<Participant> {
    const participant = await this.participantModel.findById(id).exec();

    if (!participant) {
      const translatedMessage = await this.i18nService.t('PARTICIPANT.NOT_FOUND', { args: { id } });
      throw new NotFoundException(translatedMessage);
    }

    return participant;
  }

  async create(createParticipantDto: CreateParticipantDto): Promise<Participant> {
    // Check if participant already exists for this bid
    const existingParticipant = await this.participantModel.findOne({
      bid: createParticipantDto.bid,
      buyer: createParticipantDto.buyer,
    }).exec();

    if (existingParticipant) {
      const translatedMessage = await this.i18nService.t('PARTICIPANT.ALREADY_EXISTS');
      throw new BadRequestException(translatedMessage);
    }

    const createdParticipant = new this.participantModel(createParticipantDto);
    return createdParticipant.save();
  }

  async update(id: string, updateParticipantDto: UpdateParticipantDto): Promise<Participant> {
    const updatedParticipant = await this.participantModel
      .findByIdAndUpdate(id, updateParticipantDto, { new: true })
      .exec();

    if (!updatedParticipant) {
      const translatedMessage = await this.i18nService.t('PARTICIPANT.NOT_FOUND', { args: { id } });
      throw new NotFoundException(translatedMessage);
    }

    return updatedParticipant;
  }

  async remove(id: string): Promise<Participant> {
    const deletedParticipant = await this.participantModel.findByIdAndDelete(id).exec();

    if (!deletedParticipant) {
      const translatedMessage = await this.i18nService.t('PARTICIPANT.NOT_FOUND', { args: { id } });
      throw new NotFoundException(translatedMessage);
    }

    return deletedParticipant;
  }

  async getParticipantsByBidId(bidId: string): Promise<Participant[]> {
    return this.participantModel
      .find({ bid: bidId })
      .populate('buyer', 'firstName lastName phone')
      .populate('bid', 'title')
      .lean()
      .exec();
  }

  async getParticipants(): Promise<Participant[]> {
    return this.participantModel
      .find()
      .populate('buyer', 'firstName lastName phone')
      .populate('bid', 'title')
      .lean()
      .exec();
  }
}