import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class ResetPasswordInput {
  @Field()
  email: string;

  @Field()
  language: string; // 'en' or 'ar'
}
