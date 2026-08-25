import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Evidence Integrity & Provenance Ledger | Polygon Amoy</title>
        <meta name="description" content="Cryptographic tamper-proof digital evidence registration and verification platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
