import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateTestInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;
}
