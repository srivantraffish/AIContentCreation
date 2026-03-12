## Run Note

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required local env values live in `.env.local`. For translation mode, make sure these are set:

- `OPENAI_API_KEY`
- `BFL_TRANSLATE_API_KEY`
- `BFL_TRANSLATE_BASE_URL`
- `BFL_TRANSLATE_MODEL_PATH`
- `BFL_TRANSLATE_GUIDANCE`
- `BFL_TRANSLATE_STEPS`

Current translation flow:

1. OpenAI extracts visible ad text and returns normalized source-to-translation mappings.
2. BFL `flux-2-flex` edits the full image using those mappings.
3. The UI shows the translated image plus an `OpenAI debug output` section for the mappings.

If `.env.local` changes while the app is running, restart `npm run dev`.

## Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
