import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto.js';

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
