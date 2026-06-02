import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { CartellaService } from './cartella.service';
import { PatientProfileObject, PatientProfileInput } from './dto/patient-profile.object';
import { LabResultObject, LabResultInput } from './dto/lab-result.object';

@Resolver()
export class CartellaResolver {
  constructor(private readonly svc: CartellaService) {}

  @Query(() => PatientProfileObject, { name: 'patientProfile', nullable: true })
  profile(@Args('vcfFileId') vcfFileId: string) {
    return this.svc.getProfile(vcfFileId);
  }

  @Query(() => [LabResultObject], { name: 'labResults' })
  labs(@Args('vcfFileId') vcfFileId: string) {
    return this.svc.listLabResults(vcfFileId);
  }

  @Mutation(() => PatientProfileObject, { name: 'upsertPatientProfile' })
  upsert(
    @Args('vcfFileId') vcfFileId: string,
    @Args('input') input: PatientProfileInput,
  ) {
    return this.svc.upsertProfile(vcfFileId, input);
  }

  @Mutation(() => LabResultObject, { name: 'addLabResult' })
  add(
    @Args('vcfFileId') vcfFileId: string,
    @Args('input') input: LabResultInput,
  ) {
    return this.svc.addLabResult(vcfFileId, input);
  }

  @Mutation(() => Boolean, { name: 'deleteLabResult' })
  del(@Args('id', { type: () => ID }) id: string) {
    return this.svc.deleteLabResult(id);
  }
}
