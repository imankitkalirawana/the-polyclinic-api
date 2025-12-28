import { IsUUID, IsInt, Min } from 'class-validator';

/**
 * DTO for creating a Razorpay order
 * Amount is validated but MUST still be calculated on backend
 */
export class CreateOrderDto {
  /**
   * Appointment ID for which payment is being created
   */
  @IsUUID()
  appointmentId: string;

  /**
   * Amount in rupees (will be converted to paise internally)
   * This value should be validated again on backend before use
   */
  @IsInt()
  @Min(1)
  amount: number;
}
