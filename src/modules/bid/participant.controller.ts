import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ParticipantService } from './participant.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Participants')
@Controller('participant')
export class ParticipantController {
  constructor(private readonly participantService: ParticipantService) { }

  @Get()
  async getAllParticipants() {
    return this.participantService.getParticipants();
  }

  @Get('bid/:id')
  async getParticipantsByBidId(@Param('id') id: string) {
    return this.participantService.getParticipantsByBidId(id);
  }

  @Post('bid/:id')
  async createParticipant(
    @Param('id') id: string,
    @Body() createParticipantDto: CreateParticipantDto,
  ) {
    // Set the bid ID from the URL parameter
    createParticipantDto.bid = id;
    return this.participantService.create(createParticipantDto);
  }

  @Delete(':id')
  async removeParticipant(@Param('id') id: string) {
    return this.participantService.remove(id);
  }

  @Post('sync-counts')
  async syncParticipantCounts() {
    return this.participantService.syncAllBidParticipantCounts();
  }
}