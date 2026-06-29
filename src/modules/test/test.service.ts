import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ensureFirebaseAdminInitialized,
  getFirestore,
} from '../../config/firebase-admin';
import { CreateTestInput } from './dto/create-test.input';
import { UpdateTestInput } from './dto/update-test.input';
import { Test } from './dto/test.type';
import { DeleteTestResponse } from './dto/delete-test-response.type';

const COLLECTION = 'tests';

@Injectable()
export class TestService {
  constructor(private readonly configService: ConfigService) {
    ensureFirebaseAdminInitialized(this.configService);
  }

  private get collection() {
    return getFirestore(this.configService).collection(COLLECTION);
  }

  private async withFirestore<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error?.code === 5 || String(error?.message).includes('NOT_FOUND')) {
        const projectId =
          this.configService.get<string>('FIREBASE_PROJECT_ID') || 'unknown';
        throw new ServiceUnavailableException(
          `Firestore database not found for project "${projectId}". ` +
            'Create a Firestore database in Firebase Console → Firestore Database → Create database.',
        );
      }
      throw error;
    }
  }

  private mapDoc(
    id: string,
    data: FirebaseFirestore.DocumentData,
  ): Test {
    return {
      id,
      name: data.name,
      description: data.description,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async findAll(): Promise<Test[]> {
    return this.withFirestore(async () => {
      const snapshot = await this.collection
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map((doc) => this.mapDoc(doc.id, doc.data()));
    });
  }

  async findOne(id: string): Promise<Test> {
    if (!id?.trim()) {
      throw new BadRequestException('ID is required');
    }

    const doc = await this.withFirestore(() => this.collection.doc(id).get());
    if (!doc.exists) {
      throw new NotFoundException(`Test with ID "${id}" not found`);
    }

    return this.mapDoc(doc.id, doc.data()!);
  }

  async create(input: CreateTestInput): Promise<Test> {
    if (!input.name?.trim()) {
      throw new BadRequestException('Name is required');
    }

    const now = new Date().toISOString();
    const data = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };

    return this.withFirestore(async () => {
      const docRef = await this.collection.add(data);
      const doc = await docRef.get();
      return this.mapDoc(doc.id, doc.data()!);
    });
  }

  async update(input: UpdateTestInput): Promise<Test> {
    if (!input.id?.trim()) {
      throw new BadRequestException('ID is required');
    }

    return this.withFirestore(async () => {
      const docRef = this.collection.doc(input.id);
      const existing = await docRef.get();
      if (!existing.exists) {
        throw new NotFoundException(`Test with ID "${input.id}" not found`);
      }

      const updates: Record<string, string | null> = {
        updatedAt: new Date().toISOString(),
      };

      if (input.name !== undefined) {
        if (!input.name.trim()) {
          throw new BadRequestException('Name cannot be empty');
        }
        updates.name = input.name.trim();
      }

      if (input.description !== undefined) {
        updates.description = input.description?.trim() || null;
      }

      await docRef.update(updates);
      const updated = await docRef.get();
      return this.mapDoc(updated.id, updated.data()!);
    });
  }

  async remove(id: string): Promise<DeleteTestResponse> {
    if (!id?.trim()) {
      throw new BadRequestException('ID is required');
    }

    return this.withFirestore(async () => {
      const docRef = this.collection.doc(id);
      const existing = await docRef.get();
      if (!existing.exists) {
        throw new NotFoundException(`Test with ID "${id}" not found`);
      }

      await docRef.delete();
      return {
        success: true,
        message: `Test with ID "${id}" deleted successfully`,
      };
    });
  }
}
