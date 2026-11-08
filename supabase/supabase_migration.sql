-- ==================================================================================
-- SemKit Supabase Migration: Short Name, Acronym Search & Sequential Notes Renaming
-- Paste and run this script in your Supabase SQL Editor
-- ==================================================================================

-- 1. Add short_name and keywords columns to subjects table if not exists
ALTER TABLE public.subjects 
ADD COLUMN IF NOT EXISTS short_name TEXT,
ADD COLUMN IF NOT EXISTS keywords TEXT;

-- Create fast search indices for acronym & keyword lookups
CREATE INDEX IF NOT EXISTS idx_subjects_short_name ON public.subjects(short_name);
CREATE INDEX IF NOT EXISTS idx_subjects_code ON public.subjects(code);

-- 2. Populate short_name and syllabus keywords for all existing subjects
UPDATE public.subjects
SET 
  short_name = CASE 
    WHEN LOWER(name) LIKE '%cryptography%' THEN 'CIS'
    WHEN LOWER(name) LIKE '%data science%' AND LOWER(name) NOT LIKE '%lab%' THEN 'DSV'
    WHEN LOWER(name) LIKE '%data science%' AND LOWER(name) LIKE '%lab%' THEN 'DSV Lab'
    WHEN LOWER(name) LIKE '%dsv lab%' THEN 'DSV Lab'
    WHEN LOWER(name) LIKE '%blockchain%' THEN 'FBT'
    WHEN LOWER(name) LIKE '%cloud computing%' THEN 'FCC'
    WHEN LOWER(name) LIKE '%big data%' THEN 'BDA'
    WHEN LOWER(name) LIKE '%compiler%' THEN 'CD'
    WHEN LOWER(name) LIKE '%machine learning%' THEN 'ML'
    WHEN LOWER(name) LIKE '%artificial intelligence%' THEN 'AI'
    WHEN LOWER(name) LIKE '%operating system%' THEN 'OS'
    WHEN LOWER(name) LIKE '%computer network%' THEN 'CN'
    WHEN LOWER(name) LIKE '%database%' OR LOWER(name) LIKE '%dbms%' THEN 'DBMS'
    WHEN LOWER(name) LIKE '%software engineering%' THEN 'SE'
    WHEN LOWER(name) LIKE '%discrete mathematics%' THEN 'DM'
    WHEN LOWER(name) LIKE '%digital logic%' THEN 'DLD'
    WHEN LOWER(name) LIKE '%java%' THEN 'OOPJ'
    WHEN LOWER(name) LIKE '%python%' THEN 'PP'
    WHEN LOWER(name) LIKE '%r programming%' THEN 'RP'
    WHEN LOWER(name) LIKE '%project management%' THEN 'PM'
    WHEN LOWER(name) LIKE '%mefa%' THEN 'MEFA'
    ELSE COALESCE(short_name, UPPER(SUBSTRING(name FROM 1 FOR 3)))
  END,
  keywords = CASE
    WHEN LOWER(name) LIKE '%cryptography%' THEN 
      'cryptography, cis, a57055, security, encryption, decryption, rsa, des, aes, hash, cipher, digital signature, network security'
    WHEN LOWER(name) LIKE '%data science%' AND LOWER(name) NOT LIKE '%lab%' THEN 
      'data science, visualisation, dsv, pandas, numpy, matplotlib, seaborn, data visualization, analytics, statistics, python'
    WHEN LOWER(name) LIKE '%data science%' AND LOWER(name) LIKE '%lab%' THEN 
      'dsv lab, data science lab, visualization lab, practicals, manual, python'
    WHEN LOWER(name) LIKE '%blockchain%' THEN 
      'blockchain, fbt, a57065, bitcoin, ethereum, smart contracts, distributed ledger, crypto, consensus, web3'
    WHEN LOWER(name) LIKE '%cloud computing%' THEN 
      'cloud, fcc, a57060, aws, azure, gcp, virtualization, iaas, paas, saas, containers, docker, kubernetes'
    WHEN LOWER(name) LIKE '%big data%' THEN 
      'big data, bda, hadoop, hdfs, mapreduce, spark, nosql, hive, pig'
    WHEN LOWER(name) LIKE '%compiler%' THEN 
      'compiler design, cd, lex, yacc, parsing, syntax analysis, lexical analyzer, code generation, intermediate code'
    WHEN LOWER(name) LIKE '%machine learning%' THEN 
      'machine learning, ml, regression, classification, svm, knn, neural networks, decision trees, deep learning'
    WHEN LOWER(name) LIKE '%operating system%' THEN 
      'operating systems, os, processes, threads, scheduling, deadlocks, memory management, paging, semaphores'
    WHEN LOWER(name) LIKE '%computer network%' THEN 
      'computer networks, cn, osi model, tcp ip, routing, switching, ip addressing, socket programming'
    WHEN LOWER(name) LIKE '%database%' OR LOWER(name) LIKE '%dbms%' THEN 
      'dbms, database, sql, er diagram, normalization, transactions, acid properties, relational algebra'
    ELSE COALESCE(keywords, LOWER(name))
  END
WHERE short_name IS NULL OR keywords IS NULL;

-- 3. Ensure category column exists in content_items if used alongside type
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE public.content_items 
SET category = type 
WHERE category IS NULL;

-- 4. Retroactively rename all existing PDF rows using ROW_NUMBER() OVER (...)
-- Format:
-- - Unit Notes: CIS Unit-1-1, CIS Unit-1-2, etc.
-- - PYQs: CIS PYQ-1, CIS PYQ-2, etc.
-- - Important Questions: CIS IMP-1, etc.
WITH ranked_items AS (
  SELECT 
    ci.id,
    COALESCE(s.short_name, 'SUB') AS s_code,
    COALESCE(ci.type, ci.category, 'note') AS item_type,
    COALESCE(ci.unit_number, 1) AS unit_num,
    ROW_NUMBER() OVER (
      PARTITION BY ci.subject_id, COALESCE(ci.type, ci.category, 'note'), COALESCE(ci.unit_number, 0)
      ORDER BY ci.created_at ASC, ci.id ASC
    ) AS seq_number
  FROM public.content_items ci
  JOIN public.subjects s ON s.id = ci.subject_id
)
UPDATE public.content_items ci
SET title = CASE
  WHEN r.item_type IN ('note', 'notes') THEN 
    r.s_code || ' Unit-' || r.unit_num || '-' || r.seq_number
  WHEN r.item_type IN ('pyq') THEN 
    r.s_code || ' PYQ-' || r.seq_number
  WHEN r.item_type IN ('imp') THEN 
    r.s_code || ' IMP-' || r.seq_number
  ELSE 
    r.s_code || ' Unit-' || r.unit_num || '-' || r.seq_number
END
FROM ranked_items r
WHERE ci.id = r.id;

-- Summary verification query
SELECT 
  s.name AS subject_name,
  s.short_name,
  ci.title AS renamed_title,
  ci.type,
  ci.unit_number,
  ci.created_at
FROM public.content_items ci
JOIN public.subjects s ON s.id = ci.subject_id
ORDER BY s.short_name, ci.type, ci.unit_number, ci.title
LIMIT 50;
