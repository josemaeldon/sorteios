import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  // In production builds we replace env vars with placeholders so Docker can inject
  // the real values at runtime via docker-entrypoint.sh (sed).
  const runtimeEnvPlaceholders = isProd
    ? {
        "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("__VITE_SUPABASE_URL__"),
        "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
          "__VITE_SUPABASE_PUBLISHABLE_KEY__"
        ),
        "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify("__VITE_SUPABASE_PROJECT_ID__"),
        "import.meta.env.VITE_API_BASE_URL": JSON.stringify("__VITE_API_BASE_URL__"),
        "import.meta.env.VITE_BASIC_AUTH_USER": JSON.stringify("__VITE_BASIC_AUTH_USER__"),
        "import.meta.env.VITE_BASIC_AUTH_PASS": JSON.stringify("__VITE_BASIC_AUTH_PASS__"),
      }
    : undefined;

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: runtimeEnvPlaceholders,
  };
});
