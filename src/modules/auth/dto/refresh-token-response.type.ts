import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class RefreshTokenResponse {
  @Field(() => String, { description: 'New custom token for the user' })
  token: string;

  @Field(() => String, { description: 'User ID (uid)' })
  uid: string;
}
