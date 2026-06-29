import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class DeleteTestResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}
