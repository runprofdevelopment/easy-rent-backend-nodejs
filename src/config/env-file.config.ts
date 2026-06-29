export function getEnvFilePath(): string {
  switch (process.env.NODE_ENV) {
    case 'production':
      return '.envProduction';
    case 'staging':
      return '.envStaging';
    default:
      return '.env';
  }
}
