import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { BidService } from '../../modules/bid/bid.service';

@Injectable()
export class AuctionOwnerGuard implements CanActivate {
  constructor(private readonly bidService: BidService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const auctionId = request.params.id;

    if (!user || !auctionId) {
      // This should technically be caught by AuthGuard or route definition, but good practice to check
      throw new UnauthorizedException('Authentication details are missing.');
    }

    // We need an async function to use await
    return this.validateAuctionOwner(user.id, auctionId);
  }

  private async validateAuctionOwner(userId: string, auctionId: string): Promise<boolean> {
    try {
      const auction = await this.bidService.findOne(auctionId); 

      // Use the correct property 'owner' based on the Bid schema
      // Also, ensure owner is populated or handle potential undefined/null cases if necessary
      // The check below assumes `owner` is populated and is an object with an _id
      if (!auction.owner || auction.owner._id.toString() !== userId.toString()) { 
        throw new UnauthorizedException('You do not have permission to access offers for this auction/bid.');
      }
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error validating auction/bid owner:", error);
      throw new UnauthorizedException('An error occurred while verifying auction/bid ownership.');
    }
  }
} 