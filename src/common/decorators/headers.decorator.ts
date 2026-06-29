import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const Headers = createParamDecorator(
  (data: string | undefined, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    if (!data) {
      return request.headers;
    }

    const lowerKey = data.toLowerCase();
    const headerKey = Object.keys(request.headers).find(
      (key) => key.toLowerCase() === lowerKey,
    );

    return headerKey ? request.headers[headerKey] : undefined;
  },
);
