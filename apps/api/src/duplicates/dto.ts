import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ResolveDuplicatesDto {
  @ApiProperty({
    description:
      'Natural keys of the duplicate groups to resolve, taken from the duplicate report. ' +
      'Every group is confirmed explicitly — there is no resolve-everything call.',
    type: [String],
    example: ['ord-1::9780141036144'],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Select at least one duplicate group to resolve.' })
  @IsString({ each: true })
  keys!: string[];
}
