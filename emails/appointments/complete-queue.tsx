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

export const subject = 'Your Appointment Summary & Prescription';

export default function CompletedQueueEmail() {
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
            Your Appointment Summary & Prescription
          </Text>

          <Text className="text-md font-light text-foreground text-center mt-4">
            Appointment ID: <span className="font-medium">#APT-1024</span>
          </Text>

          <Text className="text-md font-light text-foreground text-center mt-1">
            Completed on: 16 Jan 2026
          </Text>
        </Section>

        <Hr className="my-[50px] border-gray-200" />

        {/* Summary Card */}
        <Section className="bg-[#f7f7f7] rounded-xl shadow-xl px-6 py-6 font-medium">
          <Row className="mb-4">
            <Column className="w-[35%]">
              <Text className="text-foreground m-0">Title</Text>
            </Column>
            <Column className="w-[65%]">
              <Text className="m-0">Fever</Text>
            </Column>
          </Row>

          <Row className="mb-4">
            <Column className="w-[35%]">
              <Text className="text-foreground m-0">Prescription</Text>
            </Column>
            <Column className="w-[65%]">
              <Text className="m-0">PCM – 3 times a day</Text>
            </Column>
          </Row>

          <Row className="mb-4">
            <Column className="w-[35%]">
              <Text className="text-foreground m-0">Patient Notes</Text>
            </Column>
            <Column className="w-[65%]">
              <Text className="m-0">No patient notes provided</Text>
            </Column>
          </Row>

          <Row className="mb-4">
            <Column className="w-[35%]">
              <Text className="text-foreground m-0">Completed By</Text>
            </Column>
            <Column className="w-[65%]">
              <Text className="m-0 leading-relaxed">
                Dr. Ananya Sharma <br />
                <span className="text-sm text-foreground">
                  Jan 16, 11:45 AM
                </span>
              </Text>
            </Column>
          </Row>

          <Row>
            <Column className="w-[35%]">
              <Text className="text-foreground m-0">Payment Mode</Text>
            </Column>
            <Column className="w-[65%]">
              <Text className="m-0">CASH</Text>
            </Column>
          </Row>
        </Section>

        {/* CTA */}
        <Section align="center" className="mt-10">
          <Link
            href="#"
            className="bg-brand text-white px-10 py-3 rounded-full text-sm font-semibold no-underline inline-block"
          >
            Download Prescription (PDF)
          </Link>
        </Section>

        <Hr className="my-10 border-gray-200" />

        {/* Footer Note */}
        <Section>
          <Text className="text-sm text-foreground leading-relaxed">
            <span className="font-medium">Important:</span> Please consult the
            pharmacy regarding portion. Contact The Polyclinic for any queries.
          </Text>
        </Section>
      </Container>
    </BaseComponent>
  );
}
