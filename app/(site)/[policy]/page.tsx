// Policy pages rendered from settings markdown. 404 while a policy is empty.
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import logo from "@/public/logo.png";
import { getSettings } from "@/lib/settings-server";
import { POLICY_KEYS, POLICY_TITLES, policyBody, type PolicyKey } from "@/lib/settings";

export const dynamicParams = false;
export const generateStaticParams = () => POLICY_KEYS.map((policy) => ({ policy }));

type Props = { params: Promise<{ policy: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { policy } = await params;
  const s = await getSettings();
  const key = policy as PolicyKey;
  return { title: `${POLICY_TITLES[key]} · ${s.brand_name}`, alternates: { canonical: `/${key}` } };
}

export default async function PolicyPage({ params }: Props) {
  const { policy } = await params;
  const key = policy as PolicyKey;
  const s = await getSettings();
  const body = policyBody(s, key);
  if (!body) notFound();
  return (
    <div className="site">
      <header className="top">
        <Link className="mark" href="/" aria-label={`${s.brand_name} home`}>
          <Image src={logo} alt={s.brand_name} style={{ width: "auto", height: 38 }} sizes="88px" priority />
        </Link>
        <Link className="pill" href="/#preorder">
          <i className="dot" aria-hidden="true" />
          Join the Pre-order List
        </Link>
      </header>
      <main className="policy">
        <h1>{POLICY_TITLES[key]}</h1>
        <div className="prose">
          <Markdown>{body}</Markdown>
        </div>
      </main>
    </div>
  );
}
