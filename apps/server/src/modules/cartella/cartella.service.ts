import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientProfileInput } from './dto/patient-profile.object';
import { LabResultInput } from './dto/lab-result.object';

@Injectable()
export class CartellaService {
  constructor(private readonly prisma: PrismaService) {}

  getProfile(vcfFileId: string) {
    return this.prisma.patientProfile.findUnique({ where: { vcfFileId } });
  }

  upsertProfile(vcfFileId: string, input: PatientProfileInput) {
    return this.prisma.patientProfile.upsert({
      where: { vcfFileId },
      create: { vcfFileId, ...input },
      update: { ...input },
    });
  }

  // Esami: per analita, e all'interno dal più recente.
  listLabResults(vcfFileId: string) {
    return this.prisma.labResult.findMany({
      where: { vcfFileId },
      orderBy: [{ analyte: 'asc' }, { measuredAt: 'desc' }],
    });
  }

  addLabResult(vcfFileId: string, input: LabResultInput) {
    return this.prisma.labResult.create({ data: { vcfFileId, ...input } });
  }

  async deleteLabResult(id: string): Promise<boolean> {
    try {
      await this.prisma.labResult.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
