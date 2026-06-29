import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class RefreshTokenInput {
  @Field(() => String, { description: 'User ID (uid) for token refresh' })
  uid: string;
}
