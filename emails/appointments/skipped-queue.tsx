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

export const subject = 'We Missed You';

export default function SkippedQueueEmail() {
  return (
    <BaseComponent>
      <Container className="max-w-[520px] mx-auto font-Roboto">
        {/* Header */}
        <Section>
          <Text className="text-lg font-medium">The Polyclinic</Text>
        </Section>

        {/* Title */}
        <Section align="center">
          <Text className="text-4xl text-brand leading-tight text-center">
            We Missed You
          </Text>

          <Text className="text-md font-light text-foreground text-center mt-3 leading-relaxed">
            Your appointment was skipped because you weren’t available when
            called. The doctor has moved on to the next patient.
          </Text>
        </Section>

        <Hr className="my-[50px] border-gray-200" />

        {/* Info Card */}
        <Section className="bg-[#f7f7f7] rounded-xl shadow-xl px-6 py-6 font-medium">
          <Row className="mb-4">
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Patient</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className="m-0">Kitti Sharma</Text>
            </Column>
          </Row>

          <Row className="mb-3">
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Doctor</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className="m-0">Dr. Ananya Sharma</Text>
            </Column>
          </Row>

          <Row className="mb-3">
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Time</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className="m-0">11:30 AM</Text>
            </Column>
          </Row>

          <Row>
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Mode</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className="m-0">In-clinic</Text>
            </Column>
          </Row>
        </Section>

        {/* CTA */}
        <Section align="center" className="mt-10">
          <Link
            href="#"
            className="bg-brand text-white px-10 py-3 rounded-full text-sm font-semibold no-underline inline-block"
          >
            Re-join Queue
          </Link>

          <Text className="mt-4 text-sm">
            <Link href="#" className="underline text-foreground font-medium">
              Reschedule Appointment
            </Link>
          </Text>
        </Section>

        <Hr className="my-10 border-gray-200" />

        {/* Footer Note */}
        <Section>
          <Text className="text-sm text-foreground leading-relaxed">
            If you need to reschedule or cancel your appointment, please contact
            us at least 24 hours in advance.
          </Text>
        </Section>
      </Container>
    </BaseComponent>
  );
}
