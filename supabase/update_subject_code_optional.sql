-- Run this in your Supabase SQL Editor to make the subject code optional

ALTER TABLE subjects ALTER COLUMN code DROP NOT NULL;
