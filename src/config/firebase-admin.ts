import * as admin from 'firebase-admin';
import { getFirestore as getFirestoreInstance } from 'firebase-admin/firestore';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';

export function ensureFirebaseAdminInitialized(
  configService: ConfigService,
): void {
  if (admin.apps.length) {
    return;
  }

  try {
    const serviceAccountPath = configService.get<string>(
      'GOOGLE_APPLICATION_CREDENTIALS',
    );
    const projectId =
      configService.get<string>('FIREBASE_PROJECT_ID') || '';

    if (serviceAccountPath) {
      const resolvedPath = serviceAccountPath.startsWith('./')
        ? join(process.cwd(), serviceAccountPath)
        : serviceAccountPath;

      if (existsSync(resolvedPath)) {
        const serviceAccount = require(resolvedPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId || serviceAccount.project_id,
        });
        console.info(
          'Firebase Admin initialized with service account credentials',
        );
        return;
      }
    }

    admin.initializeApp({ projectId });
    console.info('Firebase Admin initialized with default credentials');
  } catch (error) {
    console.warn(`Failed to initialize Firebase Admin: ${error.message}`);
  }
}

export function getFirestore(
  configService?: ConfigService,
  databaseId?: string,
): admin.firestore.Firestore {
  const resolvedDatabaseId =
    databaseId ||
    configService?.get<string>('FIRESTORE_DATABASE_ID') ||
    '(default)';

  if (resolvedDatabaseId === '(default)') {
    return getFirestoreInstance();
  }

  return getFirestoreInstance(admin.app(), resolvedDatabaseId);
}
