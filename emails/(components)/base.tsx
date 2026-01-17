import {
  Body,
  Html,
  Head,
  Font,
  Tailwind,
  Section,
  Hr,
  Text,
} from '@react-email/components';
import tailwindConfig from 'tailwind.config';

export default function BaseComponent({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Roboto"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Tailwind config={tailwindConfig}>
        <Body className="font-apple bg-background">
          {children}
          <Section align="center">
            <Hr className="my-[65px] m-8" />
            <Text className="text-center">
              © {new Date().getFullYear()} The Polyclinic. All rights reserved.
            </Text>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}
