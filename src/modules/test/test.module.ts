import { Module } from '@nestjs/common';
import { TestService } from './test.service';
import { TestResolver } from './test.resolver';

@Module({
  providers: [TestResolver, TestService],
  exports: [TestService],
})
export class TestModule {}
