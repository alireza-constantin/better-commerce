import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({
    example: 'If the account can be verified, an email will be sent',
  })
  message!: string;
}
