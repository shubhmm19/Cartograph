import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  const { getToken } = await auth();

  return createClient(
    serverEnv.supabaseUrl,
    serverEnv.supabasePublishableKey,
    {
      accessToken: async () => getToken(),
    },
  );
}
