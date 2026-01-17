import {
  Column,
  Container,
  Hr,
  Row,
  Section,
  Text,
} from '@react-email/components';
import BaseComponent from 'emails/(components)/base';

interface SendOtpProps {
  otp: string;
}
export default function SendOtp({ otp }: SendOtpProps) {
  return (
    <BaseComponent>
      <Container className="px-4 py-10">
        <Section align="center" className="mb-6">
          <Text className="text-2xl font-semibold  text-center">
            The Polyclinic
          </Text>
        </Section>

        <Hr className="mb-8" />

        <Section align="center" className="mb-6">
          <Text className="text-3xl font-semibold text-brand leading-tight text-center">
            Your One-Time Password
          </Text>
          <Text className=" mt-2 text-center">
            OTP for login to The Polyclinic
          </Text>
          <Text className="text-center">
            Sent on:{' '}
            {new Date().toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </Section>
        <Section className="bg-[#eef4f3] rounded-xl px-6 py-8  mx-auto text-center">
          <Text className="text-4xl font-bold tracking-widest text-foreground mb-4">
            {otp}
          </Text>

          <Text className="  leading-relaxed">
            Please use the code to complete your login.
          </Text>
          <Text className=" ">This code is valid for 10 minutes.</Text>
        </Section>

        <Section className="mx-auto mt-8">
          <Text className="font-semibold text-foreground mb-2 ">
            Important Notes
          </Text>
          <Row>
            <Column>
              <Text className="leading-relaxed">
                • Do not share this OTP with anyone.
              </Text>
              <Text className="leading-relaxed">
                • If you did not request this, please ignore this email.
              </Text>
            </Column>
          </Row>
        </Section>
      </Container>
    </BaseComponent>
  );
}
