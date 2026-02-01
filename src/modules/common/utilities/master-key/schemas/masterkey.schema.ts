import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MasterKeyDocument = HydratedDocument<MasterKey>;

@Schema({ collection: 'utilities_master_keys', timestamps: true })
export class MasterKey {
  @Prop({ type: String, required: true })
  key: string;

  @Prop({ type: String, required: true })
  value_digest: string;

  @Prop({ type: String })
  description: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MasterKeySchema = SchemaFactory.createForClass(MasterKey);
