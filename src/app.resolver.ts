import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class AppResolver {
  @Query(() => String, { name: 'health' })
  health(): string {
    return 'ok';
  }
}
