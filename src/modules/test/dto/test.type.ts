import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Test {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
