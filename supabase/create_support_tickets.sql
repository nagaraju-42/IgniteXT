-- Create Support Tickets Table
CREATE TABLE public.support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'general', 'content')),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Allow anyone (even anonymous students) to submit a ticket
CREATE POLICY "Public can insert support tickets" 
ON public.support_tickets 
FOR INSERT 
WITH CHECK (true);

-- Allow only admins to read and update tickets
CREATE POLICY "Admins can manage support tickets" 
ON public.support_tickets 
FOR ALL 
USING (public.is_active_admin());
