import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Every VITE_* variable is compiled into the public bundle. The Gemini key must only live in
  // the Cloud Function's secret (functions/index.js), so refuse to build if it shows up here.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const leaked = Object.keys(env).filter((key) => /GEMINI|GENAI|OPENAI|ANTHROPIC/i.test(key))
  if (leaked.length) {
    throw new Error(
      `${leaked.join(', ')} would be published in the browser bundle. ` +
      'Remove it from your .env files and store it with `firebase functions:secrets:set GEMINI_API_KEY`.'
    )
  }

  return {
    plugins: [react()],
  }
})
