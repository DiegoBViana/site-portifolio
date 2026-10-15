/**
 * Contact form delivery (see src/lib/contact-form.ts and the README).
 * The Web3Forms access key is public by design (it only lets the form send to the owner's inbox).
 * Set PUBLIC_WEB3FORMS_KEY at build time (Cloudflare Pages → Settings → Environment variables or a local .env).
 * Without a key the form shows the e-mail address as a fallback.
 */
export const contactForm = {
  endpoint: 'https://api.web3forms.com/submit',
  accessKey: (import.meta.env.PUBLIC_WEB3FORMS_KEY as string | undefined) ?? '',
};
