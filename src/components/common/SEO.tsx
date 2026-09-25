import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  /**
   * Social/OG/Twitter headline. Also used for `<meta name="title">`.
   *
   * NOTE: this component deliberately does NOT render a `<title>` element.
   * Every page that mounts <SEO> also calls usePageTitle(), and Helmet's
   * <title> used to race that hook for document.title — two writers for one
   * value, so the visible title depended on effect ordering. usePageTitle is
   * the single owner of document.title; this component owns the meta tags.
   */
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: string;
}

const DEFAULT_TITLE = 'MeroDeutsch — Learn A1 German for Nepali & English Speakers';
const DEFAULT_DESCRIPTION =
  'Tailored German language training featuring interactive lessons, speech recognition, and daily review practice for Nepali and English speakers.';
const DEFAULT_CANONICAL = 'https://merodeutsch.pramods.com.np';
const DEFAULT_IMAGE = 'https://merodeutsch.pramods.com.np/og-banner.png';

export const SEO: React.FC<SEOProps> = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonical = DEFAULT_CANONICAL,
  image = DEFAULT_IMAGE,
  type = 'website',
}) => {
  return (
    <Helmet>
      {/* Primary Meta Tags — document.title is owned by usePageTitle() */}
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph / Facebook / WhatsApp */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};
