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

export const subject = 'Your Doctor is Ready';

export default function CallingQueueEmail() {
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
            Your Doctor is Ready!
          </Text>
          <Text className="text-md font-light text-foreground text-center mt-2">
            Please join your scheduled teleconsultation now.
          </Text>
          <Text className="text-sm text-foreground mt-2">
            Appointment ID: APT-10293
          </Text>
        </Section>

        <Hr className="my-[50px] border-gray-200" />

        {/* Info Card */}
        <Section className="bg-[#f7f7f7] rounded-xl shadow-xl px-6 py-6 font-medium">
          <Row className="mb-3">
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
              <Text className="text-foreground m-0">Date</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className="m-0">16 Jan 2026</Text>
            </Column>
          </Row>

          <Row className="mb-4">
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Time</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className="m-0">11:30 AM</Text>
            </Column>
          </Row>

          <Hr className="border-gray-200 my-4" />

          <Row>
            <Column className="w-[30%]">
              <Text className="text-foreground m-0">Location</Text>
            </Column>
            <Column className="w-[70%]">
              <Text className="m-0 leading-relaxed text-brand">
                The Polyclinic, Agra
              </Text>
            </Column>
          </Row>

          {/* CTA */}
          <Section align="center" className="mt-8">
            <Link
              href="#"
              className="bg-brand text-white px-8 py-3 rounded-full text-sm font-semibold no-underline inline-block"
            >
              Join Call Now
            </Link>

            <Text className="text-xs text-foreground mt-2">
              This link is active for 15 minutes.
            </Text>
          </Section>
        </Section>

        {/* Support */}
        <Section className="mt-10">
          <Row>
            <Column>
              <Text className="text-lg font-medium mb-1">Need help?</Text>
              <Text className="text-foreground m-0">
                Call us at +91 98765 43210
              </Text>
            </Column>

            <Column align="right">
              <Link className="border border-brand text-brand px-4 py-2 rounded-full text-xs no-underline">
                Support Chat
              </Link>
            </Column>
          </Row>
        </Section>
      </Container>
    </BaseComponent>
  );
}
