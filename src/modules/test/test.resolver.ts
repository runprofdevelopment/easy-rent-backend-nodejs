import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { TestService } from './test.service';
import { Test } from './dto/test.type';
import { CreateTestInput } from './dto/create-test.input';
import { UpdateTestInput } from './dto/update-test.input';
import { DeleteTestResponse } from './dto/delete-test-response.type';

@Resolver(() => Test)
export class TestResolver {
  constructor(private readonly testService: TestService) {}

  @Query(() => [Test], { name: 'tests' })
  async findAll(): Promise<Test[]> {
    return this.testService.findAll();
  }

  @Query(() => Test, { name: 'test' })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Test> {
    return this.testService.findOne(id);
  }

  @Mutation(() => Test, { name: 'createTest' })
  async create(
    @Args('createTestInput') createTestInput: CreateTestInput,
  ): Promise<Test> {
    return this.testService.create(createTestInput);
  }

  @Mutation(() => Test, { name: 'updateTest' })
  async update(
    @Args('updateTestInput') updateTestInput: UpdateTestInput,
  ): Promise<Test> {
    return this.testService.update(updateTestInput);
  }

  @Mutation(() => DeleteTestResponse, { name: 'deleteTest' })
  async remove(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DeleteTestResponse> {
    return this.testService.remove(id);
  }
}
