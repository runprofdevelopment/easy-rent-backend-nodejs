import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getEnvFilePath } from './config/env-file.config';

async function bootstrap() {
  try {
    console.log('Starting NestJS application...');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('Env file:', getEnvFilePath());
    console.log('PORT:', process.env.PORT || 8080);

    const app = await NestFactory.create(AppModule);
    console.log('App module created successfully');

    app.enableCors({
      origin: true,
      credentials: true,
    });
    console.log('CORS enabled');

    const port = parseInt(process.env.PORT || '8080', 10);
    const host = '0.0.0.0';

    console.log(`Starting server on ${host}:${port}...`);
    await app.listen(port, host);

    console.info(`✓ Server running on port ${port}`);
    console.info(`✓ GraphQL Playground: http://0.0.0.0:${port}/graphql`);
  } catch (error) {
    console.error('✗ Failed to start application:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}
bootstrap();
