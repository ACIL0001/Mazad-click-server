import { IsString, IsArray, IsOptional, IsEnum } from 'class-validator';

export enum BroadcastFilterType {
    ALL = 'ALL',
    SECTEUR = 'SECTEUR',
    WILAYA = 'WILAYA',
    USERS = 'USERS',
}

export class BroadcastDto {
    @IsString()
    message: string;

    @IsEnum(BroadcastFilterType)
    filterType: BroadcastFilterType;

    @IsOptional()
    @IsArray()
    filterValue: string[]; // Can be array of user IDs, sector names, or wilaya names

    @IsOptional()
    @IsString()
    sender: string;
}
