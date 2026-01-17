import {
  Column,
  Container,
  Hr,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components';
import BaseComponent from 'emails/(components)/base';
export const subject = 'Appointment Confirmation';
interface AppointmentEmailProps {
  appointmentId: string;
  patientName: string;
  patientNumber: string;
  doctorName: string;
  date: string;
  time: string;
  location: string;
  documentNo?: string;
}
export default function AppointmentEmail({
  appointmentId,
  patientName,
  patientNumber,
  doctorName,
  date,
  time,
  location,
  documentNo,
}: AppointmentEmailProps) {
  return (
    <BaseComponent>
      <Container>
        <Section>
          <Text className="font-Roboto text-lg">The polyclinic</Text>
        </Section>
        <Section align="center">
          <Text className="text-4xl text-brand leading-tight text-center">
            Thank you for booking an appointment with us.
          </Text>
          <Text className="text-md m-0 font-light text-foreground text-center leading-none">
            Appointment ID: {appointmentId}
          </Text>
          <Text className="text-md m-2 font-light text-foreground text-center leading-none">
            Booked on:{' '}
            {new Date().toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </Section>
        <Hr className="my-[65px] m-3" />
        <Section>
          <Row>
            <Column>
              <Text className="m-0 p-0 leading-[1.4] text-xl">
                DOCUMENT NO.
              </Text>
              <Text className="m-0 p-0 leading-[1.4] text-foreground">
                {documentNo}
              </Text>
            </Column>
            <Column align="right">
              <Link className="m-0 p-0 text-brand underline text-sm leading-[1.4]">
                Reschedule/Cancel
              </Link>
            </Column>
          </Row>
        </Section>
        <Section className="bg-[#f7f7f7] rounded-xl shadow-xl px-6 py-6 mt-4 font-medium">
          <Row className="mb-3">
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Patient</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className="m-0">{patientName}</Text>
            </Column>
          </Row>

          <Row className="mb-3">
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Doctor</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className=" m-0">{doctorName}</Text>
            </Column>
          </Row>

          <Row className="mb-3">
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Date</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className=" m-0">{date}</Text>
            </Column>
          </Row>

          <Row className="mb-3">
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Time</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className=" m-0">{time}</Text>
            </Column>
          </Row>

          <Row className="mb-4">
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Reason</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className="m-0">General Consultation (30 minutes)</Text>
            </Column>
          </Row>

          <Hr className="border-gray-200 my-4" />

          <Row>
            <Column className="w-[30%]">
              <Text className=" text-foreground m-0">Location</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className=" m-0 leading-relaxed">{location}</Text>
            </Column>
          </Row>
        </Section>
        <Section className="mt-12">
          <Row>
            <Column>
              <Text className="text-lg font-medium mb-2">
                Patient Information
              </Text>
              <Text className="text-foreground m-0">{patientName}</Text>
              <Text className="text-foreground  m-0">{patientNumber}</Text>
            </Column>

            <Column align="right">
              <Text className="text-lg font-medium  mb-2">
                Clinic Information
              </Text>
              <Text className=" text-foreground m-0">The Polyclinic</Text>
              <Text className=" text-foreground m-0">123 MG Road</Text>
              <Text className="text-foreground  m-0">
                Agra, Uttar Pradesh 282001
              </Text>
            </Column>
          </Row>
          <Hr className="my-8 border-gray-200" />
        </Section>
        <Section>
          <Text className="text-lg font-medium mb-3">Cancellation Policy</Text>

          <Text className="mb-2">Instructions</Text>

          <ul className="pl-4 mb-6">
            <li className="text-sm text-foreground mb-2">
              Please arrive at least 10 minutes early for your scheduled
              appointment. Late arrivals may require rescheduling.
            </li>
            <li className="text-sm text-foreground mb-2">
              Bring your insurance card and a valid photo ID for verification.
            </li>
            <li className="text-sm text-foreground mb-2">
              For questions or assistance, call us at{' '}
              <span className="text-gray-800 font-medium">+91 98765 43210</span>
              .
            </li>
          </ul>

          <Text className="text-sm text-center  underline">
            View this email in the browser
          </Text>
        </Section>
      </Container>
    </BaseComponent>
  );
}
