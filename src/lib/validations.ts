import { z } from 'zod';

export const profileSchema = z.object({
  id: z.number(),
  user_id: z.string().uuid().nullable(),
  email: z.string().email(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  username: z.string().nullable(),
  stripe_customer_id: z.string().nullable(),
  settings: z.record(z.string(), z.any()).nullable(),
});

export type Profile = z.infer<typeof profileSchema>;

