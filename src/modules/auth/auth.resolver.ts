import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { RefreshTokenInput } from './dto/refresh-token.input';
import { RefreshTokenResponse } from './dto/refresh-token-response.type';
import { ResetPasswordInput } from './dto/reset-password.input';
import { ResetPasswordResponse } from './dto/reset-password-response.type';
import { ChangePasswordInput } from './dto/change-password.input';
import { ChangePasswordResponse } from './dto/change-password-response.type';
import { Headers } from '../../common/decorators/headers.decorator';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => RefreshTokenResponse, { name: 'refreshToken' })
  async refreshToken(
    @Args('refreshTokenInput') refreshTokenInput: RefreshTokenInput,
  ): Promise<RefreshTokenResponse> {
    return this.authService.refreshToken(refreshTokenInput);
  }

  @Mutation(() => ResetPasswordResponse, { name: 'resetPassword' })
  async resetPassword(
    @Args('resetPasswordInput') resetPasswordInput: ResetPasswordInput,
    @Headers('databaseid') databaseId: string,
  ): Promise<ResetPasswordResponse> {
    return this.authService.resetPassword(resetPasswordInput, databaseId);
  }

  @Mutation(() => ChangePasswordResponse, { name: 'changePassword' })
  async changePassword(
    @Args('changePasswordInput') changePasswordInput: ChangePasswordInput,
    @Headers('authorization') token: string,
  ): Promise<ChangePasswordResponse> {
    return this.authService.changePassword(changePasswordInput, token);
  }
}
