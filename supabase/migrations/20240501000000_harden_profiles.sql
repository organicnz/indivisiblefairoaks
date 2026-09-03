-- Harden profiles table for authenticated users
-- Add user_id column that links to auth.users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id);

-- Update RLS policies to use auth.uid()
DROP POLICY IF EXISTS "Users can view their own profile." ON profiles;
CREATE POLICY "Users can view their own profile." ON profiles 
FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'email' = email);

DROP POLICY IF EXISTS "Users can update their own profile." ON profiles;
CREATE POLICY "Users can update their own profile." ON profiles 
FOR UPDATE USING (auth.uid() = user_id OR auth.jwt()->>'email' = email);

-- Create a trigger to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  )
  ON CONFLICT (email) DO UPDATE
  SET user_id = EXCLUDED.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
